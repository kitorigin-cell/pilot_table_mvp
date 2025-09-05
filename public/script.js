// Инициализация приложения
let currentUser = null;
let allFlights = [];
let allUsers = [];

// Инициализация приложения Telegram
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Инициализация Supabase (правильный подход)
function initSupabase() {
    const SUPABASE_URL = 'https://zswbiikivjvuoolmufzd.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2JpaWtpdmp2dW9vbG11ZnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwODExMTYsImV4cCI6MjA3MjY1NzExNn0.tlJDNSTL-eK1NzMqdiZliHPbHMBgDZfddnhW78I9tyQ';
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

//const supabase = initSupabase();
let supabase = null;
// Основная функция инициализации
async function initApp() {
    try {
        // Получаем данные пользователя из Telegram
        const initData = tg.initDataUnsafe;
        const tgId = initData.user?.id;
        const userName = `${initData.user?.first_name} ${initData.user?.last_name || ''}`.trim();
        
        if (!tgId) {
            showError('Не удалось получить данные пользователя');
            return;
        }

        // Проверяем/создаем пользователя в БД
        supabase = await initSupabase();
        currentUser = await getOrCreateUser(tgId, userName);
        
        // Обновляем UI в соответствии с ролью
        updateUIForRole(currentUser.role);
        
        // Загружаем данные
        await loadFlights();
        if (currentUser.role === 'admin') {
            await loadUsers();
        }
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки приложения');
    }
}

// Получение или создание пользователя
async function getOrCreateUser(tgId, userName) {
    // Проверяем существование пользователя
    const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('tg_id', tgId)
        .single();
    
    if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
    }
    
    if (existingUser) {
        return existingUser;
    }
    
    // Создаем нового пользователя с ролью pilot по умолчанию
    const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ tg_id: tgId, name: userName, role: 'pilot' }])
        .select()
        .single();
    
    if (insertError) {
        throw insertError;
    }
    
    // Логируем действие
    await logAction('create', 'users', newUser.id, null, newUser);
    
    return newUser;
}

// Загрузка полетов
async function loadFlights() {
    try {
        let query = supabase
            .from('flights')
            .select('*')
            .order('date', { ascending: false });
        
        // Для менеджера скрываем затраты и прибыль
        if (currentUser.role === 'manager') {
            query = query.select('id, date, route, manager_comment, pilot_comment, status, created_at');
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        allFlights = data;
        renderFlightsTable(allFlights);
        
    } catch (error) {
        console.error('Ошибка загрузки полетов:', error);
        showError('Не удалось загрузить данные о полетах');
    }
}

// Рендер таблицы полетов
function renderFlightsTable(flights) {
    const container = document.getElementById('flights-table-container');
    
    if (flights.length === 0) {
        container.innerHTML = '<p>Нет данных о полетах</p>';
        return;
    }
    
    let tableHTML = `
        <table class="flights-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Маршрут</th>
                    <th>Статус</th>
                    <th>Коммент менеджера</th>
                    <th>Коммент пилота</th>
                    ${currentUser.role !== 'manager' ? '<th>Затраты</th><th>Прибыль</th>' : ''}
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    flights.forEach(flight => {
        const statusIcon = getStatusIcon(flight.status);
        const formattedDate = new Date(flight.date).toLocaleDateString('ru-RU');
        
        tableHTML += `
            <tr>
                <td>${formattedDate}</td>
                <td>${escapeHtml(flight.route)}</td>
                <td><span class="status-badge ${flight.status}">${statusIcon} ${getStatusText(flight.status)}</span></td>
                <td>${escapeHtml(flight.manager_comment || '')}</td>
                <td>${escapeHtml(flight.pilot_comment || '')}</td>
                ${currentUser.role !== 'manager' ? 
                    `<td>${flight.costs ? flight.costs.toFixed(2) : '0.00'}</td>
                     <td>${flight.profit ? flight.profit.toFixed(2) : '0.00'}</td>` : ''}
                <td>
                    ${canEditFlight(flight) ? `<button class="btn-edit" onclick="editFlight(${flight.id})">✏️</button>` : ''}
                </td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

// Проверка прав на редактирование полета
function canEditFlight(flight) {
    switch (currentUser.role) {
        case 'admin':
            return true;
        case 'manager':
            return flight.status === 'planned' || flight.status === 'cancelled';
        case 'pilot':
            return flight.status === 'planned' || flight.status === 'in-progress';
        case 'accountant':
            return true; // Но только поля costs и profit
        default:
            return false;
    }
}

// Обновление UI в соответствии с ролью
function updateUIForRole(role) {
    const userInfoEl = document.getElementById('user-info');
    userInfoEl.innerHTML = `${currentUser.name} (${getRoleText(role)})`;
    
    const tabsContainer = document.getElementById('role-tabs');
    let tabsHTML = `<button class="tab-btn active" data-tab="flights">Рейсы</button>`;
    
    if (role === 'admin') {
        tabsHTML += `<button class="tab-btn" data-tab="users">Пользователи</button>`;
        tabsHTML += `<button class="tab-btn" data-tab="stats">Статистика</button>`;
    }
    
    if (role === 'admin' || role === 'accountant') {
        tabsHTML += `<button class="tab-btn" data-tab="stats">Статистика</button>`;
    }
    
    tabsContainer.innerHTML = tabsHTML;
    
    // Добавляем обработчики для вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    // Добавляем кнопку создания для менеджеров и администраторов
    if (role === 'manager' || role === 'admin') {
        const flightsView = document.getElementById('flights-view');
        const createButton = document.createElement('button');
        createButton.id = 'create-flight';
        createButton.className = 'btn-primary';
        createButton.innerHTML = '<i class="fas fa-plus"></i> Создать рейс';
        createButton.onclick = () => createFlight();
        flightsView.querySelector('.filters').appendChild(createButton);
    }
}

// Иконки статусов
function getStatusIcon(status) {
    switch (status) {
        case 'planned': return '📅';
        case 'cancelled': return '❌';
        case 'in-progress': return '✈️';
        case 'completed': return '✅';
        default: return '';
    }
}

// Текстовые описания статусов
function getStatusText(status) {
    const statusTexts = {
        'planned': 'Запланирован',
        'cancelled': 'Отменен',
        'in-progress': 'Выполняется',
        'completed': 'Выполнен'
    };
    return statusTexts[status] || status;
}

// Текстовые описания ролей
function getRoleText(role) {
    const roleTexts = {
        'admin': 'Администратор',
        'manager': 'Менеджер',
        'accountant': 'Бухгалтер',
        'pilot': 'Пилот'
    };
    return roleTexts[role] || role;
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);