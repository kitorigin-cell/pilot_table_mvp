// Глобальные переменные
let currentUser = null;
let allFlights = [];
let allUsers = [];
let supabase = null;
let currentEditingFlightId = null;

// Вспомогательные функции (выносим в начало)
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
    alert('Ошибка: ' + message);
}

function showSuccess(message) {
    console.log('Success:', message);
    alert('Успех: ' + message);
}

function canEditFlight(flight) {
    if (!currentUser) return false;
    
    switch (currentUser.role) {
        case 'admin': 
            return true;
        case 'manager': 
            return ['planned', 'cancelled'].includes(flight.status);
        case 'pilot': 
            // Пилот может редактировать только рейсы в статусе "запланирован" или "выполняется"
            // и только свои комментарии и статус (на "выполняется" или "выполнен")
            return ['planned', 'in-progress'].includes(flight.status);
        case 'accountant': 
            // Бухгалтер может редактировать только затраты и прибыль
            return true;
        default: 
            return false;
    }
}

// Вспомогательная функция для безопасной установки значений
function setElementValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value || '';
    }
}

function getElementValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

async function saveFlight(formData) {
    try {
        let flightData = {};
        
        // В зависимости от роли пользователя разрешаем редактирование определенных полей
        if (currentUser.role === 'admin') {
            // Админ может редактировать все поля
            flightData = {
                date: formData.get('date'),
                route: formData.get('route'),
                status: formData.get('status'),
                manager_comment: formData.get('manager_comment'),
                pilot_comment: formData.get('pilot_comment'),
                costs: parseFloat(formData.get('costs')) || 0,
                profit: parseFloat(formData.get('profit')) || 0
            };
        } 
        else if (currentUser.role === 'manager') {
            // Менеджер не может редактировать затраты и прибыль
            flightData = {
                date: formData.get('date'),
                route: formData.get('route'),
                status: formData.get('status'),
                manager_comment: formData.get('manager_comment'),
                pilot_comment: formData.get('pilot_comment')
            };
        }
        else if (currentUser.role === 'pilot') {
            // Пилот может редактировать только статус и комментарий пилота
            flightData = {
                status: formData.get('status'),
                pilot_comment: formData.get('pilot_comment')
            };
            
            // Проверяем, что пилот не меняет статус на недопустимый
            const newStatus = formData.get('status');
            if (!['in-progress', 'completed'].includes(newStatus)) {
                showError('Пилот может менять статус только на "Выполняется" или "Выполнен"');
                return;
            }
        }
        else if (currentUser.role === 'accountant') {
            // Бухгалтер может редактировать только затраты и прибыль
            flightData = {
                costs: parseFloat(formData.get('costs')) || 0,
                profit: parseFloat(formData.get('profit')) || 0
            };
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
            // Для создания нужны все обязательные поля
            if (!flightData.date || !flightData.route) {
                showError('Для создания рейса необходимо указать дату и маршрут');
                return;
            }
            
            const { error } = await supabase
                .from('flights')
                .insert([{
                    ...flightData,
                    created_by: currentUser.id
                }]);
            
            if (error) throw error;
            showSuccess('Рейс успешно создан');
        }
        
        closeFlightModal();
        await loadFlights();
        
    } catch (error) {
        console.error('Ошибка сохранения полета:', error);
        showError('Ошибка при сохранении рейса');
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
            createButton.onclick = createFlight;
            filters.appendChild(createButton);
        }
    }
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
        loadStats(); // Теперь загружаем статистику
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

// Управление модальным окном
function openFlightModal() {
    const modal = document.getElementById('flight-modal');
    if (!modal) {
        console.error('Modal not found');
        return;
    }
    
    modal.style.display = 'block';
    
    // Обновляем заголовок
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
        modalTitle.textContent = currentEditingFlightId ? 'Редактирование рейса' : 'Создание рейса';
    }
    
    // Устанавливаем текущую дату по умолчанию для нового полета
    if (!currentEditingFlightId) {
        const dateInput = document.getElementById('flight-date');
        const statusSelect = document.getElementById('flight-status');
        
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
        
        if (statusSelect) {
            statusSelect.value = 'planned';
        }
        
        // Сбрасываем форму
        const form = document.getElementById('flight-form');
        if (form) {
            form.reset();
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

// Рендер таблицы полетов
function renderFlightsTable(flights) {
    const container = document.getElementById('flights-table-container');
    if (!container) return;
    
    container.innerHTML = ''; // Очищаем контейнер
    
    if (!flights.length) {
        container.innerHTML = '<p class="no-data">Нет данных о полетах</p>';
        return;
    }
    
    // Добавляем индикатор прокрутки для мобильных
    if (window.innerWidth <= 768) {
        const indicator = document.createElement('div');
        indicator.className = 'table-scroll-indicator';
        indicator.innerHTML = '<i class="fas fa-arrows-alt-h"></i> Прокрутите в сторону для просмотра всех данных';
        container.appendChild(indicator);
    }
    
    // Добавляем переключатель вида для мобильных
    if (window.innerWidth <= 480) {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'table-view-toggle';
        
        const normalViewBtn = document.createElement('button');
        normalViewBtn.className = 'table-view-btn active';
        normalViewBtn.innerHTML = '<i class="fas fa-table"></i> Обычный вид';
        normalViewBtn.onclick = () => toggleTableView('normal', container);
        
        const stackedViewBtn = document.createElement('button');
        stackedViewBtn.className = 'table-view-btn';
        stackedViewBtn.innerHTML = '<i class="fas fa-list"></i> Стекующий вид';
        stackedViewBtn.onclick = () => toggleTableView('stacked', container);
        
        toggleContainer.appendChild(normalViewBtn);
        toggleContainer.appendChild(stackedViewBtn);
        container.appendChild(toggleContainer);
    }
    
    // Создаем обертку для таблицы
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    
    const table = document.createElement('table');
    table.className = 'flights-table';
    
    // Заголовок таблицы - для пилота скрываем столбцы затрат/прибыли
    const showFinancials = !['manager', 'pilot'].includes(currentUser.role);
    
    let tableHTML = `
        <thead>
            <tr>
                <th>Дата</th>
                <th>Маршрут</th>
                <th>Статус</th>
                <th class="mobile-hidden">Коммент менеджера</th>
                <th>Коммент пилота</th>
                ${showFinancials ? '<th>Затраты</th><th>Прибыль</th>' : ''}
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
                <td data-label="Дата">${formattedDate}</td>
                <td data-label="Маршрут">${escapeHtml(flight.route)}</td>
                <td data-label="Статус">
                    <span class="status-badge ${flight.status}">${statusIcon} ${getStatusText(flight.status)}</span>
                </td>
                <td class="mobile-hidden" data-label="Коммент менеджера">${escapeHtml(flight.manager_comment || '—')}</td>
                <td data-label="Коммент пилота">${escapeHtml(flight.pilot_comment || '—')}</td>
                ${showFinancials ? 
                    `<td data-label="Затраты">${flight.costs ? flight.costs.toFixed(2) + ' ₽' : '0.00 ₽'}</td>
                     <td data-label="Прибыль">${flight.profit ? flight.profit.toFixed(2) + ' ₽' : '0.00 ₽'}</td>` : ''}
                <td data-label="Действия">
                    ${canEdit ? `<button class="btn-edit" onclick="window.editFlight(${flight.id})">✏️</button>` : '—'}
                </td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody>`;
    table.innerHTML = tableHTML;
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
}

// Рендер таблицы пользователей
function renderUsersTable(users) {
    const container = document.getElementById('users-table-container');
    if (!container) return;
    
    container.innerHTML = ''; // Очищаем контейнер
    
    if (!users.length) {
        container.innerHTML = '<p class="no-data">Нет данных о пользователях</p>';
        return;
    }
    
    // Добавляем индикатор прокрутки для мобильных
    if (window.innerWidth <= 768) {
        const indicator = document.createElement('div');
        indicator.className = 'table-scroll-indicator';
        indicator.innerHTML = '<i class="fas fa-arrows-alt-h"></i> Прокрутите в сторону для просмотра всех данных';
        container.appendChild(indicator);
    }
    
    // Создаем обертку для таблицы
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    
    const table = document.createElement('table');
    table.className = 'users-table';
    
    let tableHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th class="mobile-hidden">Telegram ID</th>
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
                <td data-label="ID">${user.id}</td>
                <td class="mobile-hidden" data-label="Telegram ID">${user.tg_id}</td>
                <td data-label="Имя">${escapeHtml(user.name)}</td>
                <td data-label="Роль">
                    <select onchange="window.updateUserRole(${user.id}, this.value)">
                        <option value="pilot" ${user.role === 'pilot' ? 'selected' : ''}>Пилот</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                        <option value="accountant" ${user.role === 'accountant' ? 'selected' : ''}>Бухгалтер</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </td>
                <td data-label="Дата регистрации">${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody>`;
    table.innerHTML = tableHTML;
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск и фильтры
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterFlights(e.target.value, statusFilter ? statusFilter.value : '');
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            filterFlights(searchInput ? searchInput.value : '', e.target.value);
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
    
    // Кнопка создания полета (добавляем динамически)
    setTimeout(() => {
        const createBtn = document.getElementById('create-flight');
        if (createBtn) {
            createBtn.addEventListener('click', createFlight);
        }
    }, 100);
}

// Основные функции приложения
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
                    const SUPABASE_URL = 'https://zswbiikivjvuoolmufzd.supabase.co';
                    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2JpaWtpdmp2dW9vbG11ZnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwODExMTYsImV4cCI6MjA3MjY1NzExNn0.tlJDNSTL-eK1NzMqdiZliHPbHMBgDZfddnhW78I9tyQ';
                    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    console.log('Supabase initialized after wait');
                    resolve();
                }
            }, 100);
        }
    });
}

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
        // Для пилота скрываем затраты и прибыль
        else if (currentUser.role === 'pilot') {
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

// Функция загрузки статистики
async function loadStats() {
    try {
        if (!['admin', 'accountant'].includes(currentUser.role)) {
            return;
        }

        const statsView = document.getElementById('stats-view');
        if (!statsView) return;

        // Показываем заглушку пока грузятся данные
        statsView.innerHTML = `
            <div class="stats-container">
                <h3><i class="fas fa-chart-line"></i> Статистика прибыли и затрат</h3>
                <div class="loading">Загрузка данных...</div>
            </div>
        `;

        // Получаем данные для статистики
        const { data: stats, error } = await supabase
            .from('flights')
            .select('date, costs, profit, status')
            .eq('status', 'completed')
            .order('date', { ascending: true });

        if (error) throw error;

        if (!stats || stats.length === 0) {
            statsView.innerHTML = `
                <div class="stats-container">
                    <h3><i class="fas fa-chart-line"></i> Статистика прибыли и затрат</h3>
                    <p>Нет данных для отображения статистики</p>
                </div>
            `;
            return;
        }

        // Группируем данные по месяцам
        const monthlyData = stats.reduce((acc, flight) => {
            const date = new Date(flight.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
            
            if (!acc[monthKey]) {
                acc[monthKey] = {
                    month: monthName,
                    costs: 0,
                    profit: 0,
                    flights: 0
                };
            }
            
            acc[monthKey].costs += parseFloat(flight.costs) || 0;
            acc[monthKey].profit += parseFloat(flight.profit) || 0;
            acc[monthKey].flights += 1;
            
            return acc;
        }, {});

        const sortedData = Object.values(monthlyData).sort((a, b) => {
            return new Date(a.month) - new Date(b.month);
        });

        // Общая статистика
        const totalStats = {
            totalFlights: stats.length,
            totalCosts: stats.reduce((sum, f) => sum + (parseFloat(f.costs) || 0), 0),
            totalProfit: stats.reduce((sum, f) => sum + (parseFloat(f.profit) || 0), 0),
            avgProfitPerFlight: stats.length > 0 ? 
                stats.reduce((sum, f) => sum + (parseFloat(f.profit) || 0), 0) / stats.length : 0
        };

        // Рендерим статистику
        renderStats(sortedData, totalStats);

    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        const statsView = document.getElementById('stats-view');
        if (statsView) {
            statsView.innerHTML = `
                <div class="stats-container">
                    <h3><i class="fas fa-chart-line"></i> Статистика прибыли и затрат</h3>
                    <p class="error">Ошибка загрузки статистики</p>
                </div>
            `;
        }
    }
}

// Рендер статистики
function renderStats(monthlyData, totalStats) {
    const statsView = document.getElementById('stats-view');
    if (!statsView) return;

    statsView.innerHTML = `
        <div class="stats-container">
            <h3><i class="fas fa-chart-line"></i> Статистика прибыли и затрат</h3>
            
            <div class="stats-summary">
                <div class="stat-card">
                    <div class="stat-icon" style="background: #e3f2fd;">
                        <i class="fas fa-plane" style="color: #1976d2;"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${totalStats.totalFlights}</div>
                        <div class="stat-label">Всего рейсов</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: #ffebee;">
                        <i class="fas fa-money-bill-wave" style="color: #d32f2f;"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${totalStats.totalCosts.toFixed(2)} ₽</div>
                        <div class="stat-label">Общие затраты</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: #e8f5e8;">
                        <i class="fas fa-chart-line" style="color: #388e3c;"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${totalStats.totalProfit.toFixed(2)} ₽</div>
                        <div class="stat-label">Общая прибыль</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background: #fff3e0;">
                        <i class="fas fa-percentage" style="color: #f57c00;"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${totalStats.avgProfitPerFlight.toFixed(2)} ₽</div>
                        <div class="stat-label">Прибыль на рейс</div>
                    </div>
                </div>
            </div>

            <div class="charts-row">
                <div class="chart-container">
                    <h4>Прибыль и затраты по месяцам</h4>
                    <canvas id="profitCostsChart" width="400" height="300"></canvas>
                </div>
                
                <div class="chart-container">
                    <h4>Рентабельность по месяцам</h4>
                    <canvas id="profitabilityChart" width="400" height="300"></canvas>
                </div>
            </div>

            <div class="stats-table">
                <h4>Детальная статистика по месяцам</h4>
                <table class="stats-details">
                    <thead>
                        <tr>
                            <th>Месяц</th>
                            <th>Рейсов</th>
                            <th>Затраты</th>
                            <th>Прибыль</th>
                            <th>Рентабельность</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlyData.map(month => `
                            <tr>
                                <td>${month.month}</td>
                                <td>${month.flights}</td>
                                <td>${month.costs.toFixed(2)} ₽</td>
                                <td>${month.profit.toFixed(2)} ₽</td>
                                <td class="${month.profit - month.costs >= 0 ? 'positive' : 'negative'}">
                                    ${month.costs > 0 ? ((month.profit - month.costs) / month.costs * 100).toFixed(1) : '0'}%
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Инициализируем графики
    initCharts(monthlyData);
}

// Инициализация графиков
function initCharts(monthlyData) {
    const months = monthlyData.map(m => m.month);
    const costs = monthlyData.map(m => m.costs);
    const profits = monthlyData.map(m => m.profit);
    const profitability = monthlyData.map(m => m.costs > 0 ? ((m.profit - m.costs) / m.costs * 100) : 0);

    // График прибыли и затрат
    const profitCostsCtx = document.getElementById('profitCostsChart').getContext('2d');
    new Chart(profitCostsCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Затраты',
                    data: costs,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Прибыль',
                    data: profits,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Сумма (₽)'
                    }
                }
            }
        }
    });

    // График рентабельности
    const profitabilityCtx = document.getElementById('profitabilityChart').getContext('2d');
    new Chart(profitabilityCtx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Рентабельность (%)',
                data: profitability,
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Рентабельность (%)'
                    }
                }
            }
        }
    });
}

async function createFlight() {
    try {
        // Только менеджер и администратор могут создавать полеты
        if (!['admin', 'manager'].includes(currentUser.role)) {
            showError('Недостаточно прав для создания полетов');
            return;
        }

        currentEditingFlightId = null;
        
        // Сбрасываем форму перед открытием
        const form = document.getElementById('flight-form');
        if (form) {
            form.reset();
        }
        
        // Устанавливаем значения по умолчанию
        setElementValue('flight-date', new Date().toISOString().split('T')[0]);
        setElementValue('flight-status', 'planned');
        
        // Скрываем поля затрат/прибыли для менеджера
        if (currentUser.role === 'manager') {
            const costProfitFields = document.querySelectorAll('.costs-profit');
            costProfitFields.forEach(field => {
                if (field) field.style.display = 'none';
            });
        } else {
            // Показываем для админа
            const costProfitFields = document.querySelectorAll('.costs-profit');
            costProfitFields.forEach(field => {
                if (field) field.style.display = 'block';
            });
        }
        
        openFlightModal();
        
    } catch (error) {
        console.error('Ошибка создания полета:', error);
        showError('Ошибка при создании полета');
    }
}

window.editFlight = async function(flightId) {
    try {
        currentEditingFlightId = flightId;
        
        const { data: flight, error } = await supabase
            .from('flights')
            .select('*')
            .eq('id', flightId)
            .single();
        
        if (error) throw error;
        
        // Проверяем права доступа для пилота
        if (currentUser.role === 'pilot') {
            if (!['planned', 'in-progress'].includes(flight.status)) {
                showError('Вы можете редактировать только запланированные рейсы и рейсы в процессе выполнения');
                return;
            }
        }
        
        // Заполняем форму данными с проверками
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = value || '';
        };
        
        setValue('flight-id', flight.id);
        setValue('flight-date', flight.date);
        setValue('flight-route', flight.route);
        setValue('flight-status', flight.status);
        setValue('manager-comment', flight.manager_comment);
        setValue('pilot-comment', flight.pilot_comment);
        
        // Показываем поля затрат/прибыли только для админа и бухгалтера
        const costProfitFields = document.querySelectorAll('.costs-profit');
        costProfitFields.forEach(field => {
            if (field) {
                field.style.display = ['admin', 'accountant'].includes(currentUser.role) ? 'block' : 'none';
            }
        });
        
        if (['admin', 'accountant'].includes(currentUser.role)) {
            setValue('flight-costs', flight.costs);
            setValue('flight-profit', flight.profit);
        }
        
        // Блокируем поля в зависимости от роли
        const form = document.getElementById('flight-form');
        if (form) {
            const inputs = form.querySelectorAll('input, select, textarea');
            
            inputs.forEach(input => {
                if (!input) return;
                
                if (currentUser.role === 'pilot') {
                    // Пилот может редактировать только комментарий пилота и статус
                    // Причем статус только на "in-progress" или "completed"
                    if (input.id === 'flight-status') {
                        input.disabled = false;
                        // Ограничиваем выбор статусов для пилота
                        Array.from(input.options).forEach(option => {
                            option.disabled = !['in-progress', 'completed'].includes(option.value);
                        });
                    } else if (input.id === 'pilot-comment') {
                        input.disabled = false;
                    } else {
                        input.disabled = true;
                    }
                } else if (currentUser.role === 'accountant') {
                    // Бухгалтер может редактировать только затраты и прибыль
                    input.disabled = !['flight-costs', 'flight-profit'].includes(input.id);
                } else if (currentUser.role === 'manager') {
                    // Менеджер не может редактировать затраты и прибыль
                    input.disabled = ['flight-costs', 'flight-profit'].includes(input.id);
                }
            });
        }
        
        openFlightModal();
        
    } catch (error) {
        console.error('Ошибка редактирования полета:', error);
        showError('Не удалось загрузить данные полета');
    }
};

async function exportToCSV() {
    try {
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

// Функция для переключения между обычным и стековым видом таблиц
function initTableViewToggle() {
    if (window.innerWidth > 480) return;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'table-view-btn';
    toggleBtn.innerHTML = '<i class="fas fa-table"></i> Переключить вид';
    toggleBtn.onclick = toggleTableView;
    
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'table-view-toggle';
    toggleContainer.appendChild(toggleBtn);
    
    // Добавляем переключатель к таблицам
    const tables = document.querySelectorAll('.flights-table-container, .users-table-container');
    tables.forEach(container => {
        container.parentNode.insertBefore(toggleContainer.cloneNode(true), container);
    });
}

// Функция переключения вида таблицы
function toggleTableView(viewType, container) {
    const table = container.querySelector('table');
    const buttons = container.querySelectorAll('.table-view-btn');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (viewType === 'stacked') {
        table.setAttribute('data-mobile-view', 'stacked');
        container.querySelector('.table-view-btn:nth-child(2)').classList.add('active');
    } else {
        table.removeAttribute('data-mobile-view');
        container.querySelector('.table-view-btn:nth-child(1)').classList.add('active');
    }
}


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

// Инициализация приложения
async function initApp() {
    try {
        console.log('Initializing application...');
        
        await initSupabase();
        
        const tg = window.Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();

        const initData = tg.initDataUnsafe;
        const tgId = initData.user?.id;
        const userName = `${initData.user?.first_name} ${initData.user?.last_name || ''}`.trim();
        
        if (!tgId) {
            showError('Не удалось получить данные пользователя');
            return;
        }

        currentUser = await getOrCreateUser(tgId, userName);
        
        updateUIForRole(currentUser.role);
        
        await loadFlights();
        
        if (currentUser.role === 'admin') {
            await loadUsers();
        }
        
        setupEventListeners();
        // Инициализация переключателя таблиц
        initTableViewToggle();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки приложения: ' + error.message);
    }
}

// Запуск приложения
window.addEventListener('DOMContentLoaded', function() {
    if (document.readyState === 'complete') {
        initApp();
    } else {
        window.addEventListener('load', initApp);
    }
});

// Добавьте обработчик ресайза окна
window.addEventListener('resize', function() {
    if (currentUser && allFlights.length > 0) {
        renderFlightsTable(allFlights);
    }
    if (currentUser && currentUser.role === 'admin' && allUsers.length > 0) {
        renderUsersTable(allUsers);
    }
});