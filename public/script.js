// Глобальные переменные
let currentUser = null;
let allFlights = [];
let allUsers = [];
let supabase = null;
let currentEditingFlightId = null;

// Инициализация приложения
async function initApp() {
    try {
        console.log('Initializing application...');
        
        // Инициализируем Supabase
        await initSupabase();
        
        // Инициализация Telegram WebApp
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();

        // Получаем данные пользователя из Telegram
        const initData = tg.initDataUnsafe;
        const tgId = initData.user?.id;
        const userName = `${initData.user?.first_name} ${initData.user?.last_name || ''}`.trim();
        
        if (!tgId) {
            showError('Не удалось получить данные пользователя');
            return;
        }

        console.log('Telegram user ID:', tgId);
        
        // Проверяем/создаем пользователя в БД
        currentUser = await getOrCreateUser(tgId, userName);
        console.log('Current user:', currentUser);
        
        // Обновляем UI в соответствии с ролью
        updateUIForRole(currentUser.role);
        
        // Загружаем данные
        await loadFlights();
        
        if (currentUser.role === 'admin') {
            await loadUsers();
        }
        
        // Добавляем обработчики событий
        setupEventListeners();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки приложения: ' + error.message);
    }
}

// Инициализация Supabase
async function initSupabase() {
    return new Promise((resolve) => {
        if (window.supabase) {
            const SUPABASE_URL = 'https://zswbiikivjvuoolmufzd.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2JpaWtpdmp2dW9vbG11ZnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwODExMTYsImV4cCI6MjA3MjY1NzExNn0.tlJDNSTL-eK1NzMqdiZliHPbHMBgDZfddnhW78I9tyQ';
    
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized');
            resolve();
        } else {
            const checkSupabase = setInterval(() => {
                if (window.supabase) {
                    clearInterval(checkSupabase);
                    const SUPABASE_URL = 'https://your-project.supabase.co';
                    const SUPABASE_ANON_KEY = 'your-anon-key';
                    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    console.log('Supabase initialized after wait');
                    resolve();
                }
            }, 100);
        }
    });
}

// Получение или создание пользователя
async function getOrCreateUser(tgId, userName) {
    try {
        const { data: existingUser, error: selectError } = await supabase
            .from('users')
            .select('*')
            .eq('tg_id', tgId)
            .single();
        
        if (selectError) {
            if (selectError.code === 'PGRST116') {
                // Создаем нового пользователя
                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert([{ 
                        tg_id: tgId, 
                        name: userName, 
                        role: 'pilot' 
                    }])
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                return newUser;
            }
            throw selectError;
        }
        
        return existingUser;
        
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        throw error;
    }
}

// Обновление UI в соответствии с ролью
async function updateUIForRole(role) {
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl && currentUser) {
        userInfoEl.innerHTML = `${currentUser.name} (${getRoleText(role)})`;
    }
    
    const tabsContainer = document.getElementById('role-tabs');
    if (!tabsContainer) return;
    
    let tabsHTML = `<button class="tab-btn active" data-tab="flights">Рейсы</button>`;
    
    if (role === 'admin') {
        tabsHTML += `<button class="tab-btn" data-tab="users">Пользователи</button>`;
        tabsHTML += `<button class="tab-btn" data-tab="stats">Статистика</button>`;
    } else if (role === 'accountant') {
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
        const filters = flightsView.querySelector('.filters');
        
        if (filters && !document.getElementById('create-flight')) {
            const createButton = document.createElement('button');
            createButton.id = 'create-flight';
            createButton.className = 'btn-primary';
            createButton.innerHTML = '<i class="fas fa-plus"></i> Создать рейс';
            createButton.onclick = createFlight;
            filters.appendChild(createButton);
        }
    }
}

// Загрузка полетов
async function loadFlights() {
    try {
        let query = supabase
            .from('flights')
            .select('*')
            .order('date', { ascending: false });
        
        if (currentUser.role === 'manager') {
            query = query.select('id, date, route, manager_comment, pilot_comment, status, created_at');
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        allFlights = data || [];
        renderFlightsTable(allFlights);
        
    } catch (error) {
        console.error('Ошибка загрузки полетов:', error);
        showError('Не удалось загрузить данные о полетах');
    }
}

// Загрузка пользователей
async function loadUsers() {
    try {
        if (currentUser.role !== 'admin') return;
        
        const { data, error } = await supabase
            .from('users')
            .select('id, tg_id, name, role, created_at')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allUsers = data || [];
        renderUsersTable(allUsers);
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showError('Не удалось загрузить данные пользователей');
    }
}

// Создание нового полета
async function createFlight() {
    try {
        if (!['admin', 'manager'].includes(currentUser.role)) {
            showError('Недостаточно прав для создания полетов');
            return;
        }

        // Открываем модальное окно для создания
        currentEditingFlightId = null;
        openFlightModal();
        
    } catch (error) {
        console.error('Ошибка создания полета:', error);
        showError('Ошибка при создании полета');
    }
}

// Редактирование полета
window.editFlight = async function(flightId) {
    try {
        currentEditingFlightId = flightId;
        
        // Загружаем данные полета
        const { data: flight, error } = await supabase
            .from('flights')
            .select('*')
            .eq('id', flightId)
            .single();
        
        if (error) throw error;
        
        // Заполняем форму данными
        document.getElementById('flight-id').value = flight.id;
        document.getElementById('flight-date').value = flight.date;
        document.getElementById('flight-route').value = flight.route;
        document.getElementById('flight-status').value = flight.status;
        document.getElementById('manager-comment').value = flight.manager_comment || '';
        document.getElementById('pilot-comment').value = flight.pilot_comment || '';
        
        // Показываем поля затрат/прибыли для соответствующих ролей
        const costProfitFields = document.querySelectorAll('.costs-profit');
        costProfitFields.forEach(field => {
            field.style.display = ['admin', 'accountant'].includes(currentUser.role) ? 'block' : 'none';
        });
        
        if (['admin', 'accountant'].includes(currentUser.role)) {
            document.getElementById('flight-costs').value = flight.costs || '';
            document.getElementById('flight-profit').value = flight.profit || '';
        }
        
        // Блокируем поля в зависимости от роли
        const form = document.getElementById('flight-form');
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (currentUser.role === 'pilot') {
                // Пилот может редактировать только комментарий пилота и статус
                input.disabled = !(['pilot-comment', 'flight-status'].includes(input.id));
            } else if (currentUser.role === 'accountant') {
                // Бухгалтер может редактировать только затраты и прибыль
                input.disabled = !(['flight-costs', 'flight-profit'].includes(input.id));
            } else if (currentUser.role === 'manager') {
                // Менеджер не может редактировать затраты и прибыль
                input.disabled = ['flight-costs', 'flight-profit'].includes(input.id);
            }
        });
        
        openFlightModal();
        
    } catch (error) {
        console.error('Ошибка редактирования полета:', error);
        showError('Не удалось загрузить данные полета');
    }
};

// Сохранение полета
async function saveFlight(formData) {
    try {
        const flightData = {
            date: formData.get('date'),
            route: formData.get('route'),
            status: formData.get('status'),
            manager_comment: formData.get('manager_comment'),
            pilot_comment: formData.get('pilot_comment')
        };
        
        // Добавляем финансовые данные для соответствующих ролей
        if (['admin', 'accountant'].includes(currentUser.role)) {
            flightData.costs = parseFloat(formData.get('costs')) || 0;
            flightData.profit = parseFloat(formData.get('profit')) || 0;
        }
        
        if (currentEditingFlightId) {
            // Обновление существующего полета
            const { error } = await supabase
                .from('flights')
                .update(flightData)
                .eq('id', currentEditingFlightId);
            
            if (error) throw error;
            showSuccess('Рейс успешно обновлен');
        } else {
            // Создание нового полета
            const { error } = await supabase
                .from('flights')
                .insert([flightData]);
            
            if (error) throw error;
            showSuccess('Рейс успешно создан');
        }
        
        closeFlightModal();
        await loadFlights(); // Перезагружаем список
        
    } catch (error) {
        console.error('Ошибка сохранения полета:', error);
        showError('Ошибка при сохранении рейса');
    }
}

// Экспорт в CSV
async function exportToCSV() {
    try {
        // Формируем CSV содержимое
        let csvContent = 'Дата,Маршрут,Статус,Затраты,Прибыль,Комментарий менеджера,Комментарий пилота\n';
        
        allFlights.forEach(flight => {
            const row = [
                new Date(flight.date).toLocaleDateString('ru-RU'),
                `"${flight.route.replace(/"/g, '""')}"`,
                getStatusText(flight.status),
                flight.costs || '0',
                flight.profit || '0',
                `"${(flight.manager_comment || '').replace(/"/g, '""')}"`,
                `"${(flight.pilot_comment || '').replace(/"/g, '""')}"`
            ].join(',');
            
            csvContent += row + '\n';
        });
        
        // Создаем и скачиваем файл
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `flights_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccess('Данные успешно экспортированы в CSV');
        
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showError('Ошибка при экспорте данных');
    }
}

// Обновление роли пользователя
window.updateUserRole = async function(userId, newRole) {
    try {
        if (currentUser.role !== 'admin') {
            showError('Только администратор может изменять роли');
            return;
        }
        
        const { error } = await supabase
            .from('users')
            .update({ role: newRole })
            .eq('id', userId);
        
        if (error) throw error;
        
        showSuccess('Роль пользователя успешно обновлена');
        
    } catch (error) {
        console.error('Ошибка обновления роли:', error);
        showError('Не удалось обновить роль пользователя');
    }
};

// Управление модальным окном
function openFlightModal() {
    const modal = document.getElementById('flight-modal');
    if (modal) {
        modal.style.display = 'block';
        
        // Устанавливаем текущую дату по умолчанию для нового полета
        if (!currentEditingFlightId) {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('flight-date').value = today;
            document.getElementById('flight-status').value = 'planned';
            
            // Сбрасываем форму
            document.getElementById('flight-form').reset();
        }
    }
}

function closeFlightModal() {
    const modal = document.getElementById('flight-modal');
    if (modal) {
        modal.style.display = 'none';
        currentEditingFlightId = null;
    }
}

// Рендер таблиц
function renderFlightsTable(flights) {
    const container = document.getElementById('flights-table-container');
    if (!container) return;
    
    if (!flights.length) {
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
        const canEdit = canEditFlight(flight);
        
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
                    ${canEdit ? `<button class="btn-edit" onclick="window.editFlight(${flight.id})">✏️</button>` : ''}
                </td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderUsersTable(users) {
    const container = document.getElementById('users-table-container');
    if (!container) return;
    
    if (!users.length) {
        container.innerHTML = '<p>Нет данных о пользователях</p>';
        return;
    }
    
    let tableHTML = `
        <table class="users-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Telegram ID</th>
                    <th>Имя</th>
                    <th>Роль</th>
                    <th>Дата регистрации</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    users.forEach(user => {
        tableHTML += `
            <tr>
                <td>${user.id}</td>
                <td>${user.tg_id}</td>
                <td>${escapeHtml(user.name)}</td>
                <td>
                    <select onchange="window.updateUserRole(${user.id}, this.value)">
                        <option value="pilot" ${user.role === 'pilot' ? 'selected' : ''}>Пилот</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                        <option value="accountant" ${user.role === 'accountant' ? 'selected' : ''}>Бухгалтер</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </td>
                <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

// Вспомогательные функции
function canEditFlight(flight) {
    if (!currentUser) return false;
    
    switch (currentUser.role) {
        case 'admin': return true;
        case 'manager': return ['planned', 'cancelled'].includes(flight.status);
        case 'pilot': return ['planned', 'in-progress'].includes(flight.status);
        case 'accountant': return true;
        default: return false;
    }
}

function getStatusIcon(status) {
    const icons = {
        'planned': '📅', 'cancelled': '❌', 'in-progress': '✈️', 'completed': '✅'
    };
    return icons[status] || '';
}

function getStatusText(status) {
    const texts = {
        'planned': 'Запланирован', 'cancelled': 'Отменен',
        'in-progress': 'Выполняется', 'completed': 'Выполнен'
    };
    return texts[status] || status;
}

function getRoleText(role) {
    const texts = {
        'admin': 'Администратор', 'manager': 'Менеджер',
        'accountant': 'Бухгалтер', 'pilot': 'Пилот'
    };
    return texts[role] || role;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    console.error('Error:', message);
    // Можно заменить на красивые уведомления
    alert('Ошибка: ' + message);
}

function showSuccess(message) {
    console.log('Success:', message);
    // Можно заменить на красивые уведомления
    alert('Успех: ' + message);
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск и фильтры
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterFlights(e.target.value, statusFilter.value);
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            filterFlights(searchInput.value, e.target.value);
        });
    }
    
    // Экспорт CSV
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    // Модальное окно
    const modal = document.getElementById('flight-modal');
    const closeBtn = document.querySelector('.close');
    const flightForm = document.getElementById('flight-form');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFlightModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeFlightModal();
        });
    }
    
    if (flightForm) {
        flightForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveFlight(new FormData(flightForm));
        });
    }
    
    // Кнопка создания полета
    const createBtn = document.getElementById('create-flight');
    if (createBtn) {
        createBtn.addEventListener('click', createFlight);
    }
}

// Фильтрация полетов
function filterFlights(searchText, statusFilter) {
    let filtered = allFlights;
    
    if (searchText) {
        filtered = filtered.filter(flight => 
            flight.route.toLowerCase().includes(searchText.toLowerCase())
        );
    }
    
    if (statusFilter) {
        filtered = filtered.filter(flight => flight.status === statusFilter);
    }
    
    renderFlightsTable(filtered);
}

// Инициализация приложения
window.addEventListener('DOMContentLoaded', function() {
    if (document.readyState === 'complete') {
        initApp();
    } else {
        window.addEventListener('load', initApp);
    }
});