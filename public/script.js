// Глобальные переменные
let currentUser = null;
let allFlights = [];
let allUsers = [];
let supabase = null;

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
            await loadUsers(); // Теперь функция определена
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
        // Проверяем, загружена ли библиотека Supabase
        if (window.supabase) {
            const SUPABASE_URL = 'https://zswbiikivjvuoolmufzd.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2JpaWtpdmp2dW9vbG11ZnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwODExMTYsImV4cCI6MjA3MjY1NzExNn0.tlJDNSTL-eK1NzMqdiZliHPbHMBgDZfddnhW78I9tyQ';
    
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized');
            resolve();
        } else {
            // Ждем загрузки библиотеки
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
        console.log('Getting or creating user:', tgId, userName);
        
        // Проверяем существование пользователя
        const { data: existingUser, error: selectError } = await supabase
            .from('users')
            .select('*')
            .eq('tg_id', tgId)
            .single();
        
        if (selectError) {
            if (selectError.code === 'PGRST116') {
                // Пользователь не найден - создаем нового
                console.log('User not found, creating new user');
                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert([{ 
                        tg_id: tgId, 
                        name: userName, 
                        role: 'pilot' 
                    }])
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('Error creating user:', insertError);
                    throw insertError;
                }
                
                console.log('New user created:', newUser);
                return newUser;
            } else {
                console.error('Error selecting user:', selectError);
                throw selectError;
            }
        }
        
        console.log('Existing user found:', existingUser);
        return existingUser;
        
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        throw error;
    }
}

// Загрузка полетов
async function loadFlights() {
    try {
        console.log('Loading flights for role:', currentUser.role);
        
        let query = supabase
            .from('flights')
            .select('*')
            .order('date', { ascending: false });
        
        // Для менеджера скрываем затраты и прибыль
        if (currentUser.role === 'manager') {
            query = query.select('id, date, route, manager_comment, pilot_comment, status, created_at');
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        allFlights = data || [];
        console.log('Flights loaded:', allFlights.length);
        renderFlightsTable(allFlights);
        
    } catch (error) {
        console.error('Ошибка загрузки полетов:', error);
        showError('Не удалось загрузить данные о полетах');
    }
}

// Загрузка пользователей (для администратора)
async function loadUsers() {
    try {
        console.log('Loading users...');
        
        if (currentUser.role !== 'admin') {
            console.log('Access denied: only admin can load users');
            return;
        }
        
        const { data, error } = await supabase
            .from('users')
            .select('id, tg_id, name, role, created_at')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        allUsers = data || [];
        console.log('Users loaded:', allUsers.length);
        renderUsersTable(allUsers);
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showError('Не удалось загрузить данные пользователей');
    }
}

// Рендер таблицы пользователей
function renderUsersTable(users) {
    const container = document.getElementById('users-table-container');
    
    if (!container) {
        console.error('Users table container not found');
        return;
    }
    
    if (!users || users.length === 0) {
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
                    <th>Действия</th>
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
                    <select onchange="window.updateUserRole(${user.id}, this.value)" ${currentUser.role !== 'admin' ? 'disabled' : ''}>
                        <option value="pilot" ${user.role === 'pilot' ? 'selected' : ''}>Пилот</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                        <option value="accountant" ${user.role === 'accountant' ? 'selected' : ''}>Бухгалтер</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </td>
                <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                <td>
                    ${currentUser.role === 'admin' ? `<button class="btn-edit" onclick="window.editUser(${user.id})">✏️</button>` : ''}
                </td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

// Рендер таблицы полетов
function renderFlightsTable(flights) {
    const container = document.getElementById('flights-table-container');
    
    if (!container) {
        console.error('Flights table container not found');
        return;
    }
    
    if (!flights || flights.length === 0) {
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

// Проверка прав на редактирование полета
function canEditFlight(flight) {
    if (!currentUser) return false;
    
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
            createButton.onclick = () => createFlight();
            filters.appendChild(createButton);
        }
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterFlights(e.target.value, document.getElementById('status-filter').value);
        });
    }
    
    // Фильтр по статусу
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            filterFlights(document.getElementById('search-input').value, e.target.value);
        });
    }
    
    // Экспорт CSV
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
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

// Вспомогательные функции
function getStatusIcon(status) {
    switch (status) {
        case 'planned': return '📅';
        case 'cancelled': return '❌';
        case 'in-progress': return '✈️';
        case 'completed': return '✅';
        default: return '';
    }
}

function getStatusText(status) {
    const statusTexts = {
        'planned': 'Запланирован',
        'cancelled': 'Отменен',
        'in-progress': 'Выполняется',
        'completed': 'Выполнен'
    };
    return statusTexts[status] || status;
}

function getRoleText(role) {
    const roleTexts = {
        'admin': 'Администратор',
        'manager': 'Менеджер',
        'accountant': 'Бухгалтер',
        'pilot': 'Пилот'
    };
    return roleTexts[role] || role;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    console.error('Error:', message);
    alert(message);
}

function switchTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('main > div').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Показать выбранную вкладку
    const tabElement = document.getElementById(`${tabName}-view`);
    if (tabElement) {
        tabElement.style.display = 'block';
    }
    
    // Обновить активную кнопку
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Загружаем данные для вкладки если нужно
    if (tabName === 'users' && currentUser.role === 'admin') {
        loadUsers();
    } else if (tabName === 'stats' && (currentUser.role === 'admin' || currentUser.role === 'accountant')) {
        loadStats();
    }
}

// Функция загрузки статистики
async function loadStats() {
    console.log('Loading statistics...');
    // Заглушка для статистики
    const statsView = document.getElementById('stats-view');
    if (statsView) {
        statsView.innerHTML = `
            <div class="stats-container">
                <h3>Статистика прибыли и затрат</h3>
                <p>Здесь будут графики и аналитика</p>
                <canvas id="profitChart" width="400" height="200"></canvas>
            </div>
        `;
    }
}

// Глобальные функции для использования в HTML
window.editFlight = function(flightId) {
    console.log('Edit flight:', flightId);
    // Реализация редактирования полета
    alert('Редактирование полета ' + flightId);
};

window.editUser = function(userId) {
    console.log('Edit user:', userId);
    // Реализация редактирования пользователя
    alert('Редактирование пользователя ' + userId);
};

window.updateUserRole = async function(userId, newRole) {
    try {
        if (!currentUser || currentUser.role !== 'admin') {
            showError('Только администратор может изменять роли');
            return;
        }
        
        const { error } = await supabase
            .from('users')
            .update({ role: newRole })
            .eq('id', userId);
        
        if (error) throw error;
        
        showError('Роль пользователя успешно обновлена');
        
        // Обновляем таблицу пользователей
        await loadUsers();
        
    } catch (error) {
        console.error('Ошибка обновления роли:', error);
        showError('Не удалось обновить роль пользователя');
    }
};

// Инициализация приложения после полной загрузки страницы
window.addEventListener('DOMContentLoaded', function() {
    // Ждем полной загрузки всех ресурсов
    if (document.readyState === 'complete') {
        initApp();
    } else {
        window.addEventListener('load', initApp);
    }
});

// Функция создания полета (заглушка)
function createFlight() {
    console.log('Create flight');
    alert('Создание нового полета');
}

// Функция экспорта (заглушка)
function exportToCSV() {
    console.log('Export to CSV');
    alert('Экспорт данных в CSV');
}