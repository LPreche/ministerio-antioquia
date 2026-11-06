document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const adminDashboard = document.getElementById('admin-dashboard');
    const adminHeader = document.getElementById('admin-header');
    const adminFooter = document.getElementById('admin-footer');
    const adminTabsNav = document.querySelector('.admin-tabs-nav');
    const adminSectionsWrapper = document.querySelector('.admin-sections-wrapper');
    const adminMobileNavSelect = document.getElementById('admin-section-select');
    // Se você adicionar um botão de logout no seu admin.html com id="logout-btn", este código irá funcionar.
    const logoutBtn = document.getElementById('logout-btn');
    let suggestionsEventSource = null; // Variável para a conexão SSE
    let pendingSuggestions = []; // Cache para detalhes das sugestões

    // --- HELPER PARA ESCAPAR ATRIBUTOS HTML ---
    function escapeAttr(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // --- TAB NAVIGATION LOGIC ---
    function showSection(index) {
        const sections = document.querySelectorAll('.admin-sections-wrapper > .admin-section');
        const tabButtons = document.querySelectorAll('.admin-tabs-nav > .admin-tab-btn');
        if (!adminSectionsWrapper || index < 0 || index >= sections.length) return;

        tabButtons.forEach((btn, i) => btn.classList.toggle('active', i === index));
        if (tabButtons[index]) {
            tabButtons[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        adminSectionsWrapper.style.transform = `translateX(-${index * 100}%)`;

        // Sincroniza o select do menu mobile com a aba ativa
        if (adminMobileNavSelect) {
            const sectionId = sections[index].id;
            adminMobileNavSelect.value = sectionId;
        }
    }

    if (adminTabsNav) {
        adminTabsNav.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.admin-tab-btn');
            if (!targetBtn) return;
            const sections = document.querySelectorAll('.admin-sections-wrapper > .admin-section');
            const targetId = targetBtn.dataset.target;
            const targetIndex = Array.from(sections).findIndex(section => section.id === targetId);
            if (targetIndex !== -1) showSection(targetIndex);
        });
    }

    // --- LOGIC FOR MOBILE SELECT NAVIGATION ---
    if (adminMobileNavSelect) {
        adminMobileNavSelect.addEventListener('change', (e) => {
            const sections = document.querySelectorAll('.admin-sections-wrapper > .admin-section');
            const targetId = e.target.value;
            const targetIndex = Array.from(sections).findIndex(section => section.id === targetId);
            if (targetIndex !== -1) {
                showSection(targetIndex);
            }
        });
    }

    // --- LÓGICA DE ATUALIZAÇÃO EM TEMPO REAL (SSE) ---
    function setupSuggestionStream() {
        // Fecha qualquer conexão anterior para evitar duplicação
        if (suggestionsEventSource) {
            suggestionsEventSource.close();
        }

        // Inicia uma nova conexão SSE com o servidor
        suggestionsEventSource = new EventSource('/api/admin/sugestoes-stream');

        // Listener para quando uma mensagem é recebida do servidor
        suggestionsEventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                // Verifica se a mensagem é sobre uma nova sugestão
                if (data.type === 'new_suggestion') {
                    console.log('Nova sugestão recebida! Atualizando a lista...');
                    loadAdminSugestoes(); // Recarrega a lista de sugestões pendentes
                }
                // Atualizações em tempo real do relógio e solicitações de voluntários
                if (data.type === 'new_prayer_request' || data.type === 'prayer_clock_updated') {
                    console.log('Atualização de voluntários/relógio recebida!');
                    loadAdminSolicitacoes();
                    loadAdminSolicitacoesHistorico();
                    if (data.type === 'prayer_clock_updated') {
                        loadAdminRelogios();
                    }
                }
            } catch (error) {
                console.error('Erro ao processar mensagem SSE:', error);
            }
        };

        // Listener para erros na conexão
        suggestionsEventSource.onerror = function(err) {
            console.error('Erro na conexão SSE. A conexão será fechada.', err);
            // O navegador tentará reconectar automaticamente por padrão.
            // Se quisermos parar, podemos fechar aqui.
            suggestionsEventSource.close();
        };
    }

    // --- DASHBOARD AND AUTH LOGIC ---
    function showDashboard() {
        loginModal.classList.remove('is-visible');
        adminDashboard.style.display = 'block';
        adminHeader.style.display = 'flex';
        adminFooter.style.display = 'block';
        
        // Load initial data
        loadAdminNews();
        loadAdminMissionaries();
        loadAdminEvents();
        loadAdminRelogios();
        loadAdminTito(); // Nova função para a seção unificada
        loadAdminSugestoes();
        loadAdminSugestoesHistorico();
        loadAdminSolicitacoes();
        loadAdminSolicitacoesHistorico();
        loadGeneralSettings();
        setupPushNotificationForm(); // Adiciona o listener para o novo formulário

        // Inicia a escuta por atualizações em tempo real
        setupSuggestionStream();
        showSection(0); // Initialize to the first tab
    }

    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/check-auth');
            const result = await response.json();
            if (result.loggedIn) {
                showDashboard();
            } else {
                loginModal.classList.add('is-visible');
            }
        } catch (error) {
            console.error('Falha ao verificar autenticação:', error);
            loginModal.classList.add('is-visible');
        }
    }

    // --- FORM SUBMISSION ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        loginError.style.display = 'none';

        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();

            if (response.ok) {
                showDashboard();
            } else {
                loginError.textContent = result.message || 'Usuário ou senha inválidos.';
                loginError.style.display = 'block';
            }
        } catch (error) {
            loginError.textContent = 'Erro de conexão ao tentar fazer login.';
            loginError.style.display = 'block';
        }
    });

    // Verifica o status de login ao carregar a página
    checkAuthStatus();

    // --- CRUD LOGIC ---

    // Example for News
    async function loadAdminNews() {
        try {
            const response = await fetch('/api/noticias');
            if (!response.ok) throw new Error('Failed to fetch news');
            const newsItems = await response.json();
            
            const tableBody = document.querySelector('#news-table tbody');
            tableBody.innerHTML = ''; // Clear existing rows

            newsItems.forEach(item => {
                const date = new Date(item.ntc_data_publicacao).toLocaleDateString('pt-BR');
                const row = `
                    <tr data-id="${item.id_noticia}">
                        <td data-label="Título" class="truncate-cell" title="${escapeAttr(item.ntc_titulo)}">${item.ntc_titulo}</td>
                        <td data-label="Data">${date}</td>
                        <td data-label="Ações">
                            <button class="btn-edit" data-id="${item.id_noticia}" data-section="news">Editar</button>
                            <button class="btn-delete" data-id="${item.id_noticia}" data-section="news">Excluir</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading news for admin:', error);
            document.querySelector('#news-table tbody').innerHTML = `<tr><td colspan="3">Falha ao carregar notícias.</td></tr>`;
        }
    }

    async function loadAdminMissionaries() {
        try {
            const response = await fetch('/api/missionaries');
            if (!response.ok) throw new Error('Failed to fetch missionaries');
            const items = await response.json();
            
            const tableBody = document.querySelector('#missionaries-table tbody');
            tableBody.innerHTML = '';

            items.forEach(item => {
                const row = `
                    <tr data-id="${item.id_missionario}">
                        <td data-label="Nome" class="truncate-cell" title="${escapeAttr(item.nome)}">${item.nome}</td>
                        <td data-label="País">${item.mis_pais}</td>
                        <td data-label="Ações">
                            <button class="btn-edit" data-id="${item.id_missionario}" data-section="missionaries">Editar</button>
                            <button class="btn-delete" data-id="${item.id_missionario}" data-section="missionaries">Excluir</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading missionaries for admin:', error);
            document.querySelector('#missionaries-table tbody').innerHTML = `<tr><td colspan="3">Falha ao carregar missionários.</td></tr>`;
        }
    }

    async function loadAdminEvents() {
        try {
            const response = await fetch('/api/eventos');
            if (!response.ok) throw new Error('Failed to fetch events');
            const items = await response.json();
            
            const tableBody = document.querySelector('#events-table tbody');
            tableBody.innerHTML = '';

            const formatDate = (dateString) => {
                if (!dateString) return 'N/A';
                const date = new Date(dateString);
                return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
            };

            if (items.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">Nenhum evento cadastrado.</td></tr>';
                return;
            }

            items.forEach(item => {
                const row = `
                    <tr data-id="${item.id_evento}">
                        <td data-label="Título" class="truncate-cell" title="${escapeAttr(item.evt_titulo)}">${item.evt_titulo}</td>
                        <td data-label="Data Início">${formatDate(item.evt_data_inicial)}</td>
                        <td data-label="Data Fim">${formatDate(item.evt_data_final)}</td>
                        <td data-label="Ações">
                            <button class="btn-edit" data-id="${item.id_evento}" data-section="events">Editar</button>
                            <button class="btn-delete" data-id="${item.id_evento}" data-section="events">Excluir</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading events for admin:', error);
            document.querySelector('#events-table tbody').innerHTML = `<tr><td colspan="4">Falha ao carregar eventos.</td></tr>`;
        }
    }

    function formatTimeInterval(timeStr) {
        if (!timeStr) return '';
        const parts = String(timeStr).split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const endTotal = h * 60 + m + 15;
        const endH = Math.floor(endTotal / 60) % 24;
        const endM = endTotal % 60;
        const startFmt = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const endFmt = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        return `${startFmt} - ${endFmt}`;
    }

    function getAll15MinCycles() {
        const slots = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                slots.push(`${start}:00`);
            }
        }
        return slots;
    }

    function pickRandomAvailable15MinCycle(occupiedTimes = []) {
        const allSlots = getAll15MinCycles();
        const normOccupied = new Set(
            occupiedTimes.map(t => {
                if (!t) return '';
                const parts = String(t).split(':');
                const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
                const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
                return `${h}:${m}:00`;
            }).filter(Boolean)
        );
        const available = allSlots.filter(s => !normOccupied.has(s));
        if (available.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * available.length);
        return available[randomIndex];
    }

    function generate15MinOptions(selectedTime, includeAllOption = false, occupiedTimes = []) {
        let options = '';
        if (includeAllOption) {
            const isSelected = !selectedTime || selectedTime === 'todos' || selectedTime === 'geral';
            options += `<option value="" ${isSelected ? 'selected' : ''}>Todos os horários (Geral)</option>`;
        }
        const normSelected = selectedTime ? String(selectedTime).substring(0, 5) : '';
        const normOccupied = new Set(
            occupiedTimes.map(t => {
                if (!t) return '';
                const parts = String(t).split(':');
                const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
                const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
                return `${h}:${m}`;
            }).filter(Boolean)
        );

        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                const endTotal = h * 60 + m + 15;
                const endH = Math.floor(endTotal / 60) % 24;
                const endM = endTotal % 60;
                const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                const val = `${start}:00`;
                const isSel = (normSelected === start);
                const isOcc = normOccupied.has(start) && !isSel;

                if (isOcc) {
                    options += `<option value="${val}" disabled>${start} - ${end} (Já possui motivo)</option>`;
                } else {
                    options += `<option value="${val}" ${isSel ? 'selected' : ''}>${start} - ${end}</option>`;
                }
            }
        }
        return options;
    }

    async function updateAdminRelogioStats(relogioId) {
        const statsContainer = document.getElementById('relogio-stats-container');
        if (!statsContainer) return;

        if (!relogioId) {
            statsContainer.style.display = 'none';
            return;
        }

        try {
            const [volRes, motRes] = await Promise.all([
                fetch(`/api/voluntarios?relogioId=${relogioId}`),
                fetch(`/api/motivos-oracao?relogioId=${relogioId}`)
            ]);

            const voluntarios = volRes.ok ? await volRes.json() : [];
            const motivos = motRes.ok ? await motRes.json() : [];

            const normalizeToSlot = (t) => {
                if (!t) return null;
                const parts = String(t).split(':');
                const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
                const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
                return `${h}:${m}:00`;
            };

            const filledCycles = new Set();
            voluntarios.forEach(v => {
                const slot = normalizeToSlot(v.vol_horario_escolhido);
                if (slot) filledCycles.add(slot);
            });

            const totalSlots = 96;
            const filledSlotsCount = filledCycles.size;
            const availableSlotsCount = totalSlots - filledSlotsCount;
            const percentFilled = ((filledSlotsCount / totalSlots) * 100).toFixed(1);

            // Turnos de 24 slots de 15 minutos (6 horas cada)
            let madCount = 0, manCount = 0, tarCount = 0, noiCount = 0;
            filledCycles.forEach(slot => {
                const h = parseInt(slot.split(':')[0], 10);
                if (h < 6) madCount++;
                else if (h < 12) manCount++;
                else if (h < 18) tarCount++;
                else noiCount++;
            });

            const madPct = Math.round((madCount / 24) * 100);
            const manPct = Math.round((manCount / 24) * 100);
            const tarPct = Math.round((tarCount / 24) * 100);
            const noiPct = Math.round((noiCount / 24) * 100);

            const uniqueVols = new Set(
                voluntarios
                    .map(v => (v.vol_nome_completo || '').trim().toLowerCase())
                    .filter(Boolean)
            );

            // Atualizar os elementos do DOM
            const progressLabel = document.getElementById('stat-progress-label');
            const filledPercent = document.getElementById('stat-filled-percent');
            const progressBarFill = document.getElementById('stat-progress-bar-fill');
            const statFilledSlots = document.getElementById('stat-filled-slots');
            const statAvailableSlots = document.getElementById('stat-available-slots');
            const statUniqueVols = document.getElementById('stat-unique-volunteers');
            const statTotalMotivos = document.getElementById('stat-total-motivos');

            const shiftMadVal = document.getElementById('stat-shift-mad');
            const shiftMadBar = document.getElementById('stat-shift-mad-bar');
            const shiftManVal = document.getElementById('stat-shift-man');
            const shiftManBar = document.getElementById('stat-shift-man-bar');
            const shiftTarVal = document.getElementById('stat-shift-tar');
            const shiftTarBar = document.getElementById('stat-shift-tar-bar');
            const shiftNoiVal = document.getElementById('stat-shift-noi');
            const shiftNoiBar = document.getElementById('stat-shift-noi-bar');

            if (progressLabel) progressLabel.textContent = `${filledSlotsCount} de 96 horários preenchidos`;
            if (filledPercent) filledPercent.textContent = `${percentFilled}%`;
            if (progressBarFill) progressBarFill.style.width = `${percentFilled}%`;

            if (statFilledSlots) statFilledSlots.textContent = filledSlotsCount;
            if (statAvailableSlots) statAvailableSlots.textContent = availableSlotsCount;
            if (statUniqueVols) statUniqueVols.textContent = uniqueVols.size;
            if (statTotalMotivos) statTotalMotivos.textContent = motivos.length;

            if (shiftMadVal) shiftMadVal.textContent = `${madCount}/24 (${madPct}%)`;
            if (shiftMadBar) shiftMadBar.style.width = `${madPct}%`;

            if (shiftManVal) shiftManVal.textContent = `${manCount}/24 (${manPct}%)`;
            if (shiftManBar) shiftManBar.style.width = `${manPct}%`;

            if (shiftTarVal) shiftTarVal.textContent = `${tarCount}/24 (${tarPct}%)`;
            if (shiftTarBar) shiftTarBar.style.width = `${tarPct}%`;

            if (shiftNoiVal) shiftNoiVal.textContent = `${noiCount}/24 (${noiPct}%)`;
            if (shiftNoiBar) shiftNoiBar.style.width = `${noiPct}%`;

            statsContainer.style.display = 'block';
        } catch (err) {
            console.error('Erro ao atualizar estatísticas do relógio:', err);
        }
    }

    async function loadAdminPrayerClock(relogioId, isEditable = false) {
        if (!relogioId) return;
        const tableBody = document.querySelector('#prayer-clock-table tbody');
        try {
            const response = await fetch(`/api/voluntarios?relogioId=${relogioId}`);
            if (!response.ok) throw new Error('Failed to fetch volunteers');
            const items = await response.json();
            
            tableBody.innerHTML = '';

            if (items.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3">Nenhum voluntário cadastrado para este relógio.</td></tr>';
            } else {
                items.forEach(item => {
                    const timeLabel = formatTimeInterval(item.vol_horario_escolhido);

                    const actionsHtml = isEditable
                        ? `<button class="btn-edit" data-id="${item.id_voluntario}" data-section="prayer-clock">Editar</button>
                           <button class="btn-delete" data-id="${item.id_voluntario}" data-section="prayer-clock">Excluir</button>`
                        : `<span>Visualização</span>`;

                    const row = `
                        <tr data-id="${item.id_voluntario}">
                            <td data-label="Horário">${timeLabel}</td>
                            <td data-label="Nome do Voluntário" class="truncate-cell" title="${escapeAttr(item.vol_nome_completo)}">${item.vol_nome_completo}</td>
                            <td data-label="Ações">
                                ${actionsHtml}
                            </td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
            updateAdminRelogioStats(relogioId);
        } catch (error) {
            console.error('Error loading prayer clock volunteers for admin:', error);
            tableBody.innerHTML = `<tr><td colspan="3">Falha ao carregar voluntários.</td></tr>`;
            updateAdminRelogioStats(relogioId);
        }
    }

    async function loadAdminMotivosOracao(relogioId, isEditable = false) {
        if (!relogioId) return;
        const tableBody = document.querySelector('#motivos-oracao-table tbody');
        try {
            const response = await fetch(`/api/motivos-oracao?relogioId=${relogioId}`);
            if (!response.ok) throw new Error('Failed to fetch prayer requests');
            const items = await response.json();
            
            tableBody.innerHTML = '';
    
            if (items.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3">Nenhum motivo de oração cadastrado para este relógio.</td></tr>';
            } else {
                items.forEach(item => {
                    const actionsHtml = isEditable
                        ? `<button class="btn-edit" data-id="${item.id_motivo}" data-section="motivos-oracao">Editar</button>
                           <button class="btn-delete" data-id="${item.id_motivo}" data-section="motivos-oracao">Excluir</button>`
                        : `<span>Visualização</span>`;

                    const cycleLabel = item.mot_horario
                        ? `<span class="badge-cycle" style="background:#eef2f7;color:#2c3e50;padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.85rem;">${formatTimeInterval(item.mot_horario)}</span>`
                        : `<span style="color:#7f8c8d;font-style:italic;">Todos os horários (Geral)</span>`;

                    const row = `
                        <tr data-id="${item.id_motivo}">
                            <td data-label="Ciclo / Horário">${cycleLabel}</td>
                            <td data-label="Motivo de Oração" class="truncate-cell" title="${escapeAttr(item.mot_descricao)}">${item.mot_descricao}</td>
                            <td data-label="Ações">
                                ${actionsHtml}
                            </td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
            updateAdminRelogioStats(relogioId);
        } catch (error) {
            console.error('Error loading prayer requests for admin:', error);
            tableBody.innerHTML = `<tr><td colspan="3">Falha ao carregar motivos de oração.</td></tr>`;
            updateAdminRelogioStats(relogioId);
        }
    }

    async function loadAdminRelogios() {
        const select = document.getElementById('relogio-select');
        const addVolunteerBtn = document.getElementById('btn-add-volunteer');
        const prayerClockTableBody = document.querySelector('#prayer-clock-table tbody');
        const editRelogioBtn = document.getElementById('btn-edit-relogio');
        const addMotivoBtn = document.getElementById('btn-add-motivo');
        const importMotivosBtn = document.getElementById('btn-import-motivos');
        const exportPdfBtn = document.getElementById('btn-export-pdf-relogio');
        const exportPdfPreenchidosBtn = document.getElementById('btn-export-pdf-preenchidos');
        const motivosTableBody = document.querySelector('#motivos-oracao-table tbody');

        try {
            const response = await fetch('/api/relogios');
            if (!response.ok) throw new Error('Failed to fetch relogios');
            const items = await response.json();
            
            select.innerHTML = '<option value="">Selecione um relógio...</option>';

            const formatDate = (dateString) => {
                if (!dateString) return 'Data inválida';
                const date = new Date(dateString);
                // Adjust for timezone offset
                return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
            };

            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id_relogio;
                option.textContent = `${item.rel_titulo} (${formatDate(item.rel_data_relogio)})`;
                option.dataset.date = item.rel_data_relogio; // Store raw date string
                select.appendChild(option);
            });

            select.addEventListener('change', () => {
                const selectedOption = select.options[select.selectedIndex];
                const selectedId = selectedOption ? selectedOption.value : '';

                // Reset buttons first
                addVolunteerBtn.disabled = true;
                addMotivoBtn.disabled = true;
                editRelogioBtn.style.display = 'none';
                
                if (selectedId) {
                    editRelogioBtn.style.display = 'inline-block'; // Show edit clock button
                    if (importMotivosBtn) importMotivosBtn.disabled = false;
                    if (exportPdfBtn) {
                        exportPdfBtn.disabled = false;
                        exportPdfBtn.classList.remove('btn-disabled');
                    }
                    if (exportPdfPreenchidosBtn) {
                        exportPdfPreenchidosBtn.disabled = false;
                        exportPdfPreenchidosBtn.classList.remove('btn-disabled');
                    }
                    const relogioDateString = selectedOption.dataset.date;
                    
                    // --- Date Comparison Logic ---
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize today's date to midnight
                    
                    const relogioDate = new Date(relogioDateString);
                    // Adjust for timezone offset to get the correct local date from UTC string
                    const correctedRelogioDate = new Date(relogioDate.getTime() + relogioDate.getTimezoneOffset() * 60000);
                    correctedRelogioDate.setHours(0, 0, 0, 0); // Normalize clock date to midnight

                    const isEditable = correctedRelogioDate >= today;

                    // Enable/disable main buttons based on date
                    addVolunteerBtn.disabled = !isEditable;
                    addMotivoBtn.disabled = !isEditable;

                    // Load tables with editability flag
                    loadAdminPrayerClock(selectedId, isEditable);
                    loadAdminMotivosOracao(selectedId, isEditable);

                } else {
                    // No clock selected, clear tables and stats
                    prayerClockTableBody.innerHTML = '<tr><td colspan="3">Selecione um relógio para ver os voluntários.</td></tr>';
                    motivosTableBody.innerHTML = '<tr><td colspan="3">Selecione um relógio para ver os motivos de oração.</td></tr>';
                    if (exportPdfBtn) {
                        exportPdfBtn.disabled = true;
                        exportPdfBtn.classList.add('btn-disabled');
                    }
                    if (exportPdfPreenchidosBtn) {
                        exportPdfPreenchidosBtn.disabled = true;
                        exportPdfPreenchidosBtn.classList.add('btn-disabled');
                    }
                    updateAdminRelogioStats(null);
                }

                // Add/remove disabled class for visual styling
                [addVolunteerBtn, addMotivoBtn].filter(Boolean).forEach(btn => {
                    btn.disabled ? btn.classList.add('btn-disabled') : btn.classList.remove('btn-disabled');
                });
                if (importMotivosBtn) {
                    importMotivosBtn.disabled ? importMotivosBtn.classList.add('btn-disabled') : importMotivosBtn.classList.remove('btn-disabled');
                }
            });

            // Inicialização
            if (select.value === "") {
                editRelogioBtn.style.display = 'none';
                addMotivoBtn.disabled = true;
                addVolunteerBtn.disabled = true;
                if (exportPdfBtn) {
                    exportPdfBtn.disabled = true;
                    exportPdfBtn.classList.add('btn-disabled');
                }
                if (exportPdfPreenchidosBtn) {
                    exportPdfPreenchidosBtn.disabled = true;
                    exportPdfPreenchidosBtn.classList.add('btn-disabled');
                }
                [addVolunteerBtn, addMotivoBtn].filter(Boolean).forEach(btn => btn.classList.add('btn-disabled'));
                updateAdminRelogioStats(null);
            }

            if (exportPdfBtn && !exportPdfBtn.dataset.listenerAttached) {
                exportPdfBtn.dataset.listenerAttached = 'true';
                exportPdfBtn.addEventListener('click', () => {
                    const selectedId = select.value;
                    if (selectedId) {
                        exportRelogioPDF(selectedId, false);
                    } else {
                        showAlertModal({
                            title: 'Aviso',
                            message: 'Por favor, selecione um relógio de oração antes de exportar.',
                            icon: 'ℹ️'
                        });
                    }
                });
            }

            if (exportPdfPreenchidosBtn && !exportPdfPreenchidosBtn.dataset.listenerAttached) {
                exportPdfPreenchidosBtn.dataset.listenerAttached = 'true';
                exportPdfPreenchidosBtn.addEventListener('click', () => {
                    const selectedId = select.value;
                    if (selectedId) {
                        exportRelogioPDF(selectedId, true);
                    } else {
                        showAlertModal({
                            title: 'Aviso',
                            message: 'Por favor, selecione um relógio de oração antes de exportar.',
                            icon: 'ℹ️'
                        });
                    }
                });
            }

        } catch (error) {
            console.error('Error loading relogios for admin:', error);
            select.innerHTML = '<option value="">Falha ao carregar relógios</option>';
        }
    }

    function loadImageAsBase64(url, makeBlackTransparent = false) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    if (makeBlackTransparent) {
                        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const d = imgData.data;
                        for (let i = 0; i < d.length; i += 4) {
                            const r = d[i];
                            const g = d[i + 1];
                            const b = d[i + 2];
                            // Se o pixel for muito escuro (fundo preto da logo), torna transparente
                            if (r < 30 && g < 30 && b < 30) {
                                d[i + 3] = 0;
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);
                    }

                    resolve({
                        dataUrl: canvas.toDataURL('image/png'),
                        width: canvas.width,
                        height: canvas.height
                    });
                } catch (err) {
                    console.warn('Erro ao processar imagem para o PDF:', err);
                    resolve(null);
                }
            };
            img.onerror = () => {
                console.warn(`Não foi possível carregar imagem para o PDF: ${url}`);
                resolve(null);
            };
            img.src = url;
        });
    }

    async function exportRelogioPDF(relogioId, onlyFilled = false) {
        const exportBtn = onlyFilled
            ? document.getElementById('btn-export-pdf-preenchidos')
            : document.getElementById('btn-export-pdf-relogio');
        const originalText = exportBtn ? exportBtn.innerHTML : '';

        if (!window.jspdf || !window.jspdf.jsPDF) {
            await showAlertModal({
                title: 'Biblioteca não carregada',
                message: 'A biblioteca de geração de PDF (jsPDF) não foi carregada. Por favor, recarregue a página.',
                icon: '⚠️'
            });
            return;
        }

        try {
            if (exportBtn) {
                exportBtn.disabled = true;
                exportBtn.innerHTML = '<span>⏳</span> Gerando PDF...';
            }

            // 1. Buscar dados do relógio, voluntários, motivos e imagens em paralelo
            const [relogioRes, volRes, motRes, logoAntioquia, logoIbicco] = await Promise.all([
                fetch(`/api/relogios/${relogioId}`),
                fetch(`/api/voluntarios?relogioId=${relogioId}`),
                fetch(`/api/motivos-oracao?relogioId=${relogioId}`),
                loadImageAsBase64('imagens/logo.png', false),
                loadImageAsBase64('imagens/logo-ibicco.png', true)
            ]);

            if (!relogioRes.ok) throw new Error('Não foi possível obter os dados do relógio.');
            const clockData = await relogioRes.json();
            const voluntarios = volRes.ok ? await volRes.json() : [];
            const motivos = motRes.ok ? await motRes.json() : [];

            // 3. Organizar os 96 ciclos de 15 minutos
            const allCycles = getAll15MinCycles();
            const normalizeToSlot = (t) => {
                if (!t) return null;
                const parts = String(t).split(':');
                const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
                const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
                return `${h}:${m}:00`;
            };

            const cleanText = (str) => {
                if (!str) return '—';
                return String(str).replace(/<[^>]*>?/gm, '').trim() || '—';
            };

            // Identificar motivos gerais (sem horário específico)
            const motivosGerais = motivos.filter(m => {
                const h = m.mot_horario;
                return !h || h === 'geral' || h === 'todos';
            });

            // Montar linhas da tabela
            let filledSlotsCount = 0;
            const rawRows = allCycles.map(slot => {
                const timeInterval = formatTimeInterval(slot);

                // Voluntários neste horário
                const slotVols = voluntarios.filter(v => normalizeToSlot(v.vol_horario_escolhido) === slot);
                let volNome = '(Disponível)';
                let hasVol = false;
                if (slotVols.length > 0) {
                    filledSlotsCount++;
                    hasVol = true;
                    volNome = slotVols.map(v => v.vol_nome_completo).join(', ');
                }

                // Motivos neste horário
                const slotMots = motivos.filter(m => normalizeToSlot(m.mot_horario) === slot);
                const motivoTexto = slotMots.length > 0
                    ? slotMots.map(m => cleanText(m.mot_descricao)).join('\n\n')
                    : '—';

                return { timeInterval, volNome, motivoTexto, hasVol };
            });

            const tableRows = onlyFilled
                ? rawRows.filter(r => r.hasVol).map(r => [r.timeInterval, r.volNome, r.motivoTexto])
                : rawRows.map(r => [r.timeInterval, r.volNome, r.motivoTexto]);

            if (onlyFilled && tableRows.length === 0) {
                await showAlertModal({
                    title: 'Nenhum Voluntário Cadastrado',
                    message: 'Não há voluntários cadastrados neste relógio para gerar o PDF de horários preenchidos.',
                    icon: 'ℹ️'
                });
                return;
            }

            // 4. Instanciar jsPDF (A4 em milímetros)
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Banner superior na 1ª página com cantos arredondados
            doc.setFillColor(62, 38, 14); // #3E260E
            doc.roundedRect(14, 10, pageWidth - 28, 26, 2, 2, 'F');

            // Logo Antioquia (à esquerda)
            if (logoAntioquia && logoAntioquia.dataUrl) {
                try {
                    doc.addImage(logoAntioquia.dataUrl, 'PNG', 18, 13, 20, 20);
                } catch (e) {
                    console.warn('Falha ao adicionar logo Antioquia no PDF:', e);
                }
            }

            // Textos centrais do cabeçalho
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('MOVIMENTO ANTIOQUIA', 44, 21);

            doc.setTextColor(229, 195, 158); // #E5C39E dourado suave
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.text(
                onlyFilled
                    ? 'Escala Oficial de Oração • Horários Preenchidos'
                    : 'Escala Oficial de Oração • Ciclos de 15 Minutos',
                44,
                28
            );

            // Logo IBICCO (à direita)
            if (logoIbicco && logoIbicco.dataUrl) {
                try {
                    doc.addImage(logoIbicco.dataUrl, 'PNG', pageWidth - 14 - 20 - 4, 13, 20, 20);
                } catch (e) {
                    console.warn('Falha ao adicionar logo Ibicco no PDF:', e);
                }
            }

            // Nome do Relógio Centralizado entre o cabeçalho e a tabela
            doc.setTextColor(62, 38, 14); // #3E260E
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(clockData.rel_titulo || 'Relógio de Oração', pageWidth / 2, 45, { align: 'center' });

            let startTableY = 51;

            // Se houver motivos gerais para todos os horários, renderizar card destacado
            if (motivosGerais.length > 0) {
                const boxWidth = pageWidth - 28;
                const genText = motivosGerais.map(m => `• ${cleanText(m.mot_descricao)}`).join('\n');
                const lines = doc.splitTextToSize(genText, boxWidth - 10);
                const boxHeight = 9 + (lines.length * 4.2);

                doc.setFillColor(250, 248, 245);
                doc.setDrawColor(176, 140, 104);
                doc.setLineWidth(0.3);
                doc.roundedRect(14, startTableY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(62, 38, 14);
                doc.text('MOTIVOS GERAIS PARA TODA A ESCALA:', 18, startTableY + 5.5);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(55, 55, 55);
                doc.text(lines, 18, startTableY + 10.5);

                startTableY += boxHeight + 6;
            }

            // 5. Gerar a tabela com jsPDF-AutoTable
            doc.autoTable({
                startY: startTableY,
                head: [['Horário', 'Intercessor(a)', 'Motivo de Oração']],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [62, 38, 14],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 9,
                    halign: 'left',
                    cellPadding: 3.5
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 2.8,
                    textColor: [44, 62, 80],
                    lineColor: [225, 228, 232],
                    lineWidth: 0.15,
                    valign: 'top',
                    overflow: 'linebreak'
                },
                columnStyles: {
                    0: { cellWidth: 30, fontStyle: 'bold', halign: 'center' },
                    1: { cellWidth: 50 },
                    2: { cellWidth: 'auto' }
                },
                alternateRowStyles: {
                    fillColor: [248, 247, 244]
                },
                didParseCell: function(data) {
                    if (data.column.index === 1 && data.cell.raw === '(Disponível)') {
                        data.cell.styles.textColor = [160, 160, 160];
                        data.cell.styles.fontStyle = 'italic';
                    }
                    if (data.column.index === 2 && data.cell.raw === '—') {
                        data.cell.styles.textColor = [170, 170, 170];
                        data.cell.styles.halign = 'center';
                    }
                },
                margin: { top: 16, bottom: 16, left: 14, right: 14 }
            });

            // 6. Rodapé em todas as páginas
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setTextColor(130, 130, 130);
                doc.setFont('helvetica', 'normal');
                doc.text(
                    `Movimento Antioquia • ${clockData.rel_titulo || 'Relógio de Oração'}`,
                    14,
                    pageHeight - 8
                );
                doc.text(
                    `Página ${i} de ${totalPages}`,
                    pageWidth - 14,
                    pageHeight - 8,
                    { align: 'right' }
                );
            }

            // 7. Download automático do PDF
            const sanitizedTitle = (clockData.rel_titulo || 'Relogio_Oracao')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = onlyFilled
                ? `Escala_Relogio_${sanitizedTitle}_Preenchidos.pdf`
                : `Escala_Relogio_${sanitizedTitle}.pdf`;
            doc.save(filename);

        } catch (error) {
            console.error('Erro ao gerar PDF da escala:', error);
            await showAlertModal({
                title: 'Erro ao gerar PDF',
                message: `Não foi possível gerar o PDF: ${error.message}`,
                icon: '❌'
            });
        } finally {
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalText || (onlyFilled ? '<span>📋</span> Apenas Preenchidos (PDF)' : '<span>📄</span> Escala Completa (PDF)');
            }
        }
    }

    // Helper para buscar quadros e gerar as opções para um <select>
    async function getQuadrosOptions(selectedId = null) {
        try {
            const response = await fetch('/api/quadros');
            if (!response.ok) return '<option value="">Erro ao carregar quadros</option>';
            const quadros = await response.json();
            
            const formatDate = (dateString) => {
                if (!dateString) return 'Data inválida';
                const date = new Date(dateString);
                return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
            };

            let optionsHtml = '<option value="">Selecione um quadro</option>';
            quadros.forEach(quadro => {
                const text = `Quadro Tito (${formatDate(quadro.qdt_data_inicial)} - ${formatDate(quadro.qdt_data_final)})`;
                optionsHtml += `<option value="${quadro.id_quadro}" ${quadro.id_quadro == selectedId ? 'selected' : ''}>${text}</option>`;
            });
            return optionsHtml;
        } catch (error) {
            return '<option value="">Erro ao carregar quadros</option>';
        }
    }

    async function handleRelogioSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_relogio;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/relogios/${id}` : '/api/relogios';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            
            const newOrUpdatedId = id || (await response.json()).id;
            
            await loadAdminRelogios(); // Recarrega a lista de relógios
            const select = document.getElementById('relogio-select');
            select.value = newOrUpdatedId; // Mantém o relógio selecionado após a edição/criação
            select.dispatchEvent(new Event('change')); // Dispara o evento para carregar os voluntários
            return true;
        } catch (error) {
            console.error('Error submitting relogio form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }

    async function handleMotivoOracaoSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_motivo;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/motivos-oracao/${id}` : '/api/motivos-oracao';
    
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            // Recarrega a lista de motivos para o relógio selecionado
            const select = document.getElementById('relogio-select');
            const relogioId = select.value;
            if (relogioId) {
                const selectedOption = select.options[select.selectedIndex];
                const relogioDateString = selectedOption.dataset.date;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const relogioDate = new Date(relogioDateString);
                const correctedRelogioDate = new Date(relogioDate.getTime() + relogioDate.getTimezoneOffset() * 60000);
                correctedRelogioDate.setHours(0, 0, 0, 0);

                const isEditable = correctedRelogioDate >= today;
                loadAdminMotivosOracao(relogioId, isEditable);
            }
            return true;
        } catch (error) {
            console.error('Error submitting prayer request form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }

    async function loadAdminPostitsForQuadro(quadroId, isEditable = false) {
        if (!quadroId) return;
        const tableBody = document.querySelector('#postits-table tbody');
        try {
            const response = await fetch(`/api/postits?quadroId=${quadroId}`);
            if (!response.ok) throw new Error('Failed to fetch post-its');
            const items = await response.json();
            
            tableBody.innerHTML = '';
    
            if (items.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="2">Nenhum post-it cadastrado para este quadro.</td></tr>';
            } else {
                items.forEach(item => {
                    const actionsHtml = isEditable
                        ? `<button class="btn-edit" data-id="${item.id_postit}" data-section="postits">Editar</button>
                           <button class="btn-delete" data-id="${item.id_postit}" data-section="postits">Excluir</button>`
                        : `<span>Visualização</span>`;

                    const row = `
                        <tr data-id="${item.id_postit}">
                            <td data-label="Conteúdo" class="truncate-cell" title="${escapeAttr(item.pst_conteudo)}">${item.pst_conteudo}</td>
                            <td data-label="Ações">${actionsHtml}</td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error loading post-its for admin:', error);
            tableBody.innerHTML = `<tr><td colspan="2">Falha ao carregar post-its.</td></tr>`;
        }
    }

    async function loadAdminTito() {
        const select = document.getElementById('quadro-select');
        const addPostitBtn = document.getElementById('btn-add-postit');
        const editQuadroBtn = document.getElementById('btn-edit-quadro');
        const postitsTableBody = document.querySelector('#postits-table tbody');

        try {
            const response = await fetch('/api/quadros');
            if (!response.ok) throw new Error('Failed to fetch quadros');
            const items = await response.json();
            
            select.innerHTML = '<option value="">Selecione um quadro...</option>';

            const formatDate = (dateString) => {
                if (!dateString) return 'Data inválida';
                const date = new Date(dateString);
                return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
            };

            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id_quadro;
                option.textContent = `Quadro Tito (${formatDate(item.qdt_data_inicial)} - ${formatDate(item.qdt_data_final)})`;
                option.dataset.endDate = item.qdt_data_final; // Store end date
                select.appendChild(option);
            });

            select.addEventListener('change', () => {
                const selectedOption = select.options[select.selectedIndex];
                const selectedId = selectedOption.value;

                // Reset buttons first
                addPostitBtn.disabled = true;
                editQuadroBtn.style.display = 'none';

                if (selectedId) {
                    editQuadroBtn.style.display = 'inline-block';

                    const endDateString = selectedOption.dataset.endDate;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const endDate = new Date(endDateString);
                    const correctedEndDate = new Date(endDate.getTime() + endDate.getTimezoneOffset() * 60000);
                    correctedEndDate.setHours(0, 0, 0, 0);

                    const isEditable = correctedEndDate >= today;

                    addPostitBtn.disabled = !isEditable;
                    loadAdminPostitsForQuadro(selectedId, isEditable);
                } else {
                    postitsTableBody.innerHTML = '<tr><td colspan="2">Selecione um quadro para ver os post-its.</td></tr>';
                }
                addPostitBtn.disabled ? addPostitBtn.classList.add('btn-disabled') : addPostitBtn.classList.remove('btn-disabled');
            });

            if (select.value === "") {
                editQuadroBtn.style.display = 'none';
                addPostitBtn.disabled = true;
                addPostitBtn.classList.add('btn-disabled');
            }
        } catch (error) {
            console.error('Error loading quadros for admin:', error);
            select.innerHTML = '<option value="">Falha ao carregar quadros</option>';
        }
    }

    async function loadAdminSugestoes() {
        const tableBody = document.querySelector('#sugestoes-table tbody');
        if (!tableBody) return;
    
        try {
            const response = await fetch('/api/admin/sugestoes-pendentes');
            if (!response.ok) throw new Error('Falha ao buscar sugestões');
            const sugestoes = await response.json();
            pendingSuggestions = sugestoes; // Armazena no cache
    
            tableBody.innerHTML = '';
            if (sugestoes.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">Nenhuma sugestão pendente.</td></tr>';
                return;
            }
    
            const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR');
    
            sugestoes.forEach(item => {
                const row = `
                    <tr data-id="${item.id_sugestao}">
                        <td data-label="Autor">${escapeAttr(item.sug_nome_autor)}</td>
                        <td data-label="Conteúdo" class="truncate-cell" title="${escapeAttr(item.sug_conteudo)}">${escapeAttr(item.sug_conteudo)}</td>
                        <td data-label="Data">${formatDate(item.sug_data_criacao)}</td>
                        <td data-label="Ações">
                            <button class="btn-view" data-id="${item.id_sugestao}" data-section="sugestoes">Ver</button>
                            <button class="btn-approve" data-id="${item.id_sugestao}">Aprovar</button>
                            <button class="btn-refuse" data-id="${item.id_sugestao}">Recusar</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
    
        } catch (error) {
            console.error('Erro ao carregar sugestões:', error);
            tableBody.innerHTML = '<tr><td colspan="4">Erro ao carregar sugestões.</td></tr>';
        }
    }

    async function loadAdminSugestoesHistorico() {
        const tableBody = document.querySelector('#sugestoes-anteriores-table tbody');
        if (!tableBody) {
            console.error("A tabela de histórico de sugestões (id: #sugestoes-anteriores-table) não foi encontrada. Verifique se o arquivo 'admin.html' foi atualizado com o código da seção 'Sugestões Anteriores'.");
            return;
        }
    
        try {
            const response = await fetch('/api/admin/sugestoes-historico');
            if (!response.ok) throw new Error('Falha ao buscar histórico de sugestões');
            const sugestoes = await response.json();
    
            tableBody.innerHTML = '';
            if (sugestoes.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">Nenhum histórico de sugestões encontrado.</td></tr>';
                return;
            }
    
            const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR');
    
            sugestoes.forEach(item => {
                const statusClass = item.sug_status === 'aprovado' ? 'status-approved' : 'status-refused';
                const statusText = item.sug_status.charAt(0).toUpperCase() + item.sug_status.slice(1); // Capitalize

                const row = `
                    <tr data-id="${item.id_sugestao}">
                        <td data-label="Autor">${escapeAttr(item.sug_nome_autor)}</td>
                        <td data-label="Conteúdo Sugerido" class="truncate-cell" title="${escapeAttr(item.sug_conteudo)}">${escapeAttr(item.sug_conteudo)}</td>
                        <td data-label="Data">${formatDate(item.sug_data_criacao)}</td>
                        <td data-label="Status"><span class="status-badge ${statusClass}">${statusText}</span></td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
    
        } catch (error) {
            console.error('Erro ao carregar histórico de sugestões:', error);
            tableBody.innerHTML = '<tr><td colspan="4">Erro ao carregar histórico de sugestões.</td></tr>';
        }
    }

    // --- SOLICITAÇÕES DE VOLUNTÁRIOS DO RELÓGIO DE ORAÇÃO ---

    async function loadAdminSolicitacoes() {
        const tableBody = document.querySelector('#solicitacoes-table tbody');
        const badgeRequests = document.getElementById('badge-requests');
        if (!tableBody) return;

        try {
            const response = await fetch('/api/admin/solicitacoes-oracao');
            if (!response.ok) throw new Error('Falha ao buscar solicitações');
            const solicitacoes = await response.json();

            // Atualiza badge de contagem
            if (badgeRequests) {
                if (solicitacoes.length > 0) {
                    badgeRequests.textContent = solicitacoes.length;
                    badgeRequests.style.display = 'inline-block';
                } else {
                    badgeRequests.style.display = 'none';
                }
            }

            tableBody.innerHTML = '';
            if (solicitacoes.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">Nenhuma solicitação de voluntário pendente.</td></tr>';
                return;
            }

            const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR');

            solicitacoes.forEach(item => {
                const parts = (item.sol_horario_escolhido || '').split(':');
                const h = parseInt(parts[0], 10) || 0;
                const m = parseInt(parts[1], 10) || 0;
                const mEnd = (m + 15) % 60;
                const hEnd = (m + 15 === 60) ? (h + 1) % 24 : h;
                const horarioLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} - ${String(hEnd).padStart(2, '0')}:${String(mEnd).padStart(2, '0')}`;

                const row = `
                    <tr data-id="${item.id_solicitacao}">
                        <td data-label="Voluntário"><strong>${escapeAttr(item.sol_nome_completo)}</strong></td>
                        <td data-label="Horário Desejado"><span class="badge" style="background:#eaf2f8; color:#2980b9; font-weight:600; padding:4px 8px; border-radius:4px;">${horarioLabel}</span></td>
                        <td data-label="Data / Hora">${formatDate(item.sol_data_criacao)}</td>
                        <td data-label="Relógio">${escapeAttr(item.rel_titulo || 'Relógio')}</td>
                        <td data-label="Ações">
                            <button class="btn-approve-solicitacao" data-id="${item.id_solicitacao}" style="background-color: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; margin-right: 5px; font-weight: 500;">✓ Aceitar</button>
                            <button class="btn-refuse-solicitacao" data-id="${item.id_solicitacao}" style="background-color: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">✕ Recusar</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Erro ao carregar solicitações de voluntários:', error);
            tableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar solicitações.</td></tr>';
        }
    }

    async function loadAdminSolicitacoesHistorico() {
        const tableBody = document.querySelector('#solicitacoes-historico-table tbody');
        if (!tableBody) return;

        try {
            const response = await fetch('/api/admin/solicitacoes-oracao/historico');
            if (!response.ok) throw new Error('Falha ao buscar histórico de solicitações');
            const historico = await response.json();

            tableBody.innerHTML = '';
            if (historico.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">Nenhuma solicitação no histórico.</td></tr>';
                return;
            }

            const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR');

            historico.forEach(item => {
                const parts = (item.sol_horario_escolhido || '').split(':');
                const h = parseInt(parts[0], 10) || 0;
                const m = parseInt(parts[1], 10) || 0;
                const mEnd = (m + 15) % 60;
                const hEnd = (m + 15 === 60) ? (h + 1) % 24 : h;
                const horarioLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} - ${String(hEnd).padStart(2, '0')}:${String(mEnd).padStart(2, '0')}`;

                const statusText = item.sol_status === 'aprovado' ? 'Aceito' : 'Recusado';
                const statusStyle = item.sol_status === 'aprovado' 
                    ? 'background-color: #d4edda; color: #155724; padding: 3px 8px; border-radius: 4px; font-weight: 600;' 
                    : 'background-color: #f8d7da; color: #721c24; padding: 3px 8px; border-radius: 4px; font-weight: 600;';

                const row = `
                    <tr data-id="${item.id_solicitacao}">
                        <td data-label="Voluntário">${escapeAttr(item.sol_nome_completo)}</td>
                        <td data-label="Horário">${horarioLabel}</td>
                        <td data-label="Data / Hora">${formatDate(item.sol_data_criacao)}</td>
                        <td data-label="Relógio">${escapeAttr(item.rel_titulo || 'Relógio')}</td>
                        <td data-label="Status"><span style="${statusStyle}">${statusText}</span></td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Erro ao carregar histórico de solicitações:', error);
            tableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar histórico de solicitações.</td></tr>';
        }
    }

    async function loadGeneralSettings() {
        const settingsSection = document.getElementById('general-section');
        if (!settingsSection) return;
    
        try {
            const response = await fetch('/api/configuracoes');
            if (!response.ok) throw new Error('Failed to fetch settings');
            const settings = await response.json();
    
            document.getElementById('cfg_pix_ativo').checked = settings.cfg_pix_ativo;
            document.getElementById('cfg_manutencao_noticias').checked = settings.cfg_manutencao_noticias;
            document.getElementById('cfg_manutencao_relogio').checked = settings.cfg_manutencao_relogio;
            document.getElementById('cfg_manutencao_quadrotito').checked = settings.cfg_manutencao_quadrotito;
    
        } catch (error) {
            console.error('Error loading general settings:', error);
            settingsSection.innerHTML = '<p>Falha ao carregar configurações.</p>';
        }
    }
    
    async function handlePushNotificationSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const sendBtn = document.getElementById('send-push-btn');
        const statusEl = document.getElementById('push-status');
    
        const data = {
            title: form.title.value,
            body: form.body.value,
            url: form.url.value || '/'
        };
    
        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando...';
        statusEl.textContent = '';
    
        try {
            const response = await fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
    
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro no servidor');
    
            statusEl.style.color = 'green';
            statusEl.textContent = result.message || 'Notificação enviada com sucesso!';
            form.reset();
    
        } catch (error) {
            statusEl.style.color = 'red';
            statusEl.textContent = `Erro ao enviar: ${error.message}`;
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Enviar Notificação';
            setTimeout(() => { statusEl.textContent = ''; }, 5000);
        }
    }
    async function handleGeneralSettingsSave() {
        const saveBtn = document.getElementById('save-general-settings');
        const statusEl = document.getElementById('settings-save-status');
        
        const settings = {
            cfg_pix_ativo: document.getElementById('cfg_pix_ativo').checked,
            cfg_manutencao_noticias: document.getElementById('cfg_manutencao_noticias').checked,
            cfg_manutencao_relogio: document.getElementById('cfg_manutencao_relogio').checked,
            cfg_manutencao_quadrotito: document.getElementById('cfg_manutencao_quadrotito').checked,
        };
    
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        statusEl.textContent = '';
    
        try {
            const response = await fetch('/api/configuracoes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
    
            if (!response.ok) throw new Error((await response.json()).error || 'Erro no servidor');
    
            statusEl.style.color = 'green';
            statusEl.textContent = 'Configurações salvas com sucesso!';
    
        } catch (error) {
            statusEl.style.color = 'red';
            statusEl.textContent = `Erro ao salvar: ${error.message}`;
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar Configurações';
            setTimeout(() => { statusEl.textContent = ''; }, 4000);
        }
    }

    function setupPushNotificationForm() {
        const form = document.getElementById('push-notification-form');
        if (form) {
            form.addEventListener('submit', handlePushNotificationSubmit);
        }
    }

    function initializeTinyMCE(selectors) {
        tinymce.init({
            selector: selectors,
            plugins: 'lists link image media table code help wordcount',
            toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | link image | code',
            height: 350,
            menubar: false,
            language: 'pt_BR',
            language_url: 'https://cdn.jsdelivr.net/npm/tinymce-i18n@24.7.29/langs6/pt_BR.js',
            content_style: 'body { font-family:Roboto,sans-serif; font-size:14px }',
            promotion: false,
            branding: false,
            setup: function(editor) {
                editor.on('init', function() { this.focus(); });
            }
        });
    }

    // --- MODAL AND FORM HANDLING (GENERIC) ---
    const formModal = document.getElementById('form-modal');
    const formModalTitle = document.getElementById('form-modal-title');
    const dataForm = document.getElementById('data-form');
    const modalCloseBtn = formModal.querySelector('.modal-close');

    function openFormModal(title, formHtml, submitHandler) {
        formModalTitle.textContent = title;
        dataForm.innerHTML = formHtml;
        formModal.classList.add('is-visible');
        document.body.classList.add('modal-open');

        if (submitHandler) { // Check if a handler is provided
            dataForm.onsubmit = async (e) => {
                e.preventDefault();
                // O handler agora retorna true/false para indicar sucesso
                const success = await submitHandler(e);
                if (success) {
                    closeFormModal();
                }
                // Se não houver sucesso, o modal permanece aberto para o usuário corrigir.
            };
        } else {
            // If no handler, just prevent default form submission and allow buttons inside to work
            dataForm.onsubmit = (e) => e.preventDefault();
        }
    }

    function closeFormModal() {
        // Remove qualquer instância ativa do TinyMCE para evitar conflitos
        try {
            // O método `destroy()` é mais seguro que `remove()` quando o elemento do formulário
            // será completamente removido do DOM. Ele apenas limpa o editor da memória.
            // O loop `while` garante que todos os editores sejam destruídos, e a verificação
            // previne erros caso o objeto `tinymce` não esteja como esperado.
            if (window.tinymce && tinymce.editors) {
                while (tinymce.editors.length > 0) {
                    tinymce.editors[0].destroy();
                }
            }
        } catch (err) {
            console.error("Erro ao remover o editor TinyMCE:", err);
        }
        formModal.classList.remove('is-visible');
        document.body.classList.remove('modal-open');

        // Adia a limpeza do formulário para o próximo ciclo de eventos da UI (usando setTimeout com 0ms).
        // Isso evita uma "condição de corrida" em que o DOM é limpo antes que o TinyMCE
        // possa concluir seu próprio processo de limpeza, o que causava a falha na reinicialização.
        setTimeout(() => {
            dataForm.innerHTML = '';
            dataForm.onsubmit = null;
        }, 0);
    }

    modalCloseBtn.addEventListener('click', closeFormModal);

    // --- MODAL DE CONFIRMAÇÃO E AVISO PERSONALIZADO ---
    function showConfirmModal({
        title = 'Confirmar Ação',
        message = 'Tem certeza que deseja continuar?',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        confirmType = 'primary', // 'primary', 'danger', 'success'
        icon = '⚠️'
    } = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            if (!modal) {
                resolve(window.confirm(message));
                return;
            }

            const titleEl = document.getElementById('confirm-modal-title');
            const msgEl = document.getElementById('confirm-modal-message');
            const iconEl = document.getElementById('confirm-modal-icon');
            const btnConfirm = document.getElementById('confirm-modal-btn-confirm');
            const btnCancel = document.getElementById('confirm-modal-btn-cancel');

            titleEl.textContent = title;
            msgEl.innerHTML = message;
            iconEl.textContent = icon;
            btnConfirm.textContent = confirmText;
            btnCancel.textContent = cancelText;
            btnCancel.style.display = 'inline-block';

            btnConfirm.className = 'btn';
            if (confirmType === 'danger') {
                btnConfirm.style.backgroundColor = '#c0392b';
                btnConfirm.style.borderColor = '#c0392b';
                btnConfirm.style.color = '#ffffff';
            } else if (confirmType === 'success') {
                btnConfirm.style.backgroundColor = '#27ae60';
                btnConfirm.style.borderColor = '#27ae60';
                btnConfirm.style.color = '#ffffff';
            } else {
                btnConfirm.style.backgroundColor = 'var(--primary-color, #3E260E)';
                btnConfirm.style.borderColor = 'var(--primary-color, #3E260E)';
                btnConfirm.style.color = '#ffffff';
            }

            modal.classList.add('is-visible');
            document.body.classList.add('modal-open');

            const cleanup = (result) => {
                modal.classList.remove('is-visible');
                document.body.classList.remove('modal-open');
                btnConfirm.removeEventListener('click', onConfirm);
                btnCancel.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onBackdrop);
                document.removeEventListener('keydown', onKeyDown);
                resolve(result);
            };

            const onConfirm = () => cleanup(true);
            const onCancel = () => cleanup(false);
            const onBackdrop = (e) => {
                if (e.target === modal) cleanup(false);
            };
            const onKeyDown = (e) => {
                if (e.key === 'Escape') cleanup(false);
            };

            btnConfirm.addEventListener('click', onConfirm);
            btnCancel.addEventListener('click', onCancel);
            modal.addEventListener('click', onBackdrop);
            document.addEventListener('keydown', onKeyDown);

            btnConfirm.focus();
        });
    }

    function showAlertModal({
        title = 'Aviso',
        message = '',
        icon = 'ℹ️',
        buttonText = 'Entendido'
    } = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            if (!modal) {
                window.alert(message);
                resolve();
                return;
            }

            const titleEl = document.getElementById('confirm-modal-title');
            const msgEl = document.getElementById('confirm-modal-message');
            const iconEl = document.getElementById('confirm-modal-icon');
            const btnConfirm = document.getElementById('confirm-modal-btn-confirm');
            const btnCancel = document.getElementById('confirm-modal-btn-cancel');

            titleEl.textContent = title;
            msgEl.innerHTML = message;
            iconEl.textContent = icon;
            btnConfirm.textContent = buttonText;
            btnConfirm.className = 'btn';
            btnConfirm.style.backgroundColor = 'var(--primary-color, #3E260E)';
            btnConfirm.style.borderColor = 'var(--primary-color, #3E260E)';
            btnConfirm.style.color = '#ffffff';
            btnCancel.style.display = 'none';

            modal.classList.add('is-visible');
            document.body.classList.add('modal-open');

            const cleanup = () => {
                modal.classList.remove('is-visible');
                document.body.classList.remove('modal-open');
                btnCancel.style.display = 'inline-block';
                btnConfirm.removeEventListener('click', onClose);
                modal.removeEventListener('click', onBackdrop);
                document.removeEventListener('keydown', onKeyDown);
                resolve();
            };

            const onClose = () => cleanup();
            const onBackdrop = (e) => {
                if (e.target === modal) cleanup();
            };
            const onKeyDown = (e) => {
                if (e.key === 'Escape') cleanup();
            };

            btnConfirm.addEventListener('click', onClose);
            modal.addEventListener('click', onBackdrop);
            document.addEventListener('keydown', onKeyDown);

            btnConfirm.focus();
        });
    }

    // --- EVENT DELEGATION FOR ADD/EDIT/DELETE ---
    adminDashboard.addEventListener('click', async (e) => {
        const target = e.target;

        // VIEW SUGGESTION
        if (target.classList.contains('btn-view') && target.dataset.section === 'sugestoes') {
            const id = target.dataset.id;
            let suggestion = pendingSuggestions.find(s => s.id_sugestao == id);

            // Se a sugestão não for encontrada no cache, atualiza a lista e tenta novamente.
            if (!suggestion) {
                await loadAdminSugestoes();
                suggestion = pendingSuggestions.find(s => s.id_sugestao == id);
            }

            if (suggestion) {
                const formatDate = (dateString) => new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                const modalHtml = `
                    <div class="form-group">
                        <label>Autor da Sugestão</label>
                        <p style="padding: 10px; background: #f4f4f4; border-radius: 5px; margin-top: 5px;">${escapeAttr(suggestion.sug_nome_autor)}</p>
                    </div>
                    <div class="form-group">
                        <label>Conteúdo Completo</label>
                        <p style="padding: 10px; background: #f4f4f4; border-radius: 5px; margin-top: 5px; white-space: pre-wrap; word-wrap: break-word;">${escapeAttr(suggestion.sug_conteudo)}</p>
                    </div>
                    <div class="form-group">
                        <label>Data de Envio</label>
                        <p style="padding: 10px; background: #f4f4f4; border-radius: 5px; margin-top: 5px;">${formatDate(suggestion.sug_data_criacao)}</p>
                    </div>
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="button" class="btn btn-dark modal-manual-close">Fechar</button>
                    </div>
                `;
                openFormModal('Detalhes da Sugestão', modalHtml, null);
                dataForm.querySelector('.modal-manual-close').addEventListener('click', closeFormModal);
            } else {
                await showAlertModal({
                    title: 'Sugestão não encontrada',
                    message: 'Não foi possível encontrar os detalhes da sugestão. A lista foi atualizada, por favor, verifique se a sugestão ainda está pendente.',
                    icon: 'ℹ️'
                });
            }
            return; // Stop further execution
        }

        // APROVAR SUGESTAO
        if (target.classList.contains('btn-approve')) {
            const id = target.dataset.id;
            if (!id) return;
            const confirmed = await showConfirmModal({
                title: 'Aprovar Sugestão',
                message: 'Deseja aprovar esta sugestão? Um novo post-it será criado no Quadro Tito.',
                confirmText: 'Aprovar',
                confirmType: 'success',
                icon: '✅'
            });
            if (confirmed) {
                try {
                    const response = await fetch(`/api/admin/sugestoes/${id}/aprovar`, { method: 'POST' });
                    if (!response.ok) throw new Error((await response.json()).error || 'Falha ao aprovar');
                    
                    // Recarrega as listas
                    loadAdminSugestoes();
                    loadAdminSugestoesHistorico();
                    const quadroId = document.getElementById('quadro-select').value;
                    if (quadroId) {
                        const selectedOption = document.querySelector(`#quadro-select option[value="${quadroId}"]`);
                        const endDateString = selectedOption ? selectedOption.dataset.endDate : null;
                        const today = new Date(); today.setHours(0,0,0,0);
                        const endDate = endDateString ? new Date(endDateString) : today;
                        const isEditable = endDate >= today;
                        loadAdminPostitsForQuadro(quadroId, isEditable); // Recarrega post-its do quadro selecionado
                    }
                } catch (error) {
                    await showAlertModal({
                        title: 'Erro ao Aprovar',
                        message: `Erro ao aprovar: ${error.message}`,
                        icon: '❌'
                    });
                }
            }
        }

        // RECUSAR SUGESTAO
        if (target.classList.contains('btn-refuse')) {
            const id = target.dataset.id;
            if (!id) return;
            const confirmed = await showConfirmModal({
                title: 'Recusar Sugestão',
                message: 'Tem certeza que deseja recusar esta sugestão?',
                confirmText: 'Recusar',
                confirmType: 'danger',
                icon: '❌'
            });
            if (confirmed) {
                try {
                    const response = await fetch(`/api/admin/sugestoes/${id}/recusar`, { method: 'POST' });
                    if (!response.ok) throw new Error((await response.json()).error || 'Falha ao recusar');
                    loadAdminSugestoes();
                    loadAdminSugestoesHistorico();
                } catch (error) {
                    await showAlertModal({
                        title: 'Erro ao Recusar',
                        message: `Erro ao recusar: ${error.message}`,
                        icon: '❌'
                    });
                }
            }
        }

        // ACEITAR SOLICITACAO DE VOLUNTARIO DO RELOGIO
        if (target.classList.contains('btn-approve-solicitacao')) {
            const id = target.dataset.id;
            if (!id) return;
            const confirmed = await showConfirmModal({
                title: 'Aceitar Voluntário',
                message: 'Deseja aceitar este voluntário? Ele será vinculado ao relógio de oração no horário escolhido e aparecerá publicamente.',
                confirmText: 'Aceitar e Vincular',
                confirmType: 'success',
                icon: '🙏'
            });
            if (confirmed) {
                try {
                    const response = await fetch(`/api/admin/solicitacoes-oracao/${id}/aprovar`, { method: 'POST' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Falha ao aceitar solicitação');
                    
                    await showAlertModal({
                        title: 'Sucesso',
                        message: result.message || 'Solicitação aceita com sucesso!',
                        icon: '✅'
                    });
                    loadAdminSolicitacoes();
                    loadAdminSolicitacoesHistorico();
                    loadAdminRelogios(); // Atualiza voluntários na seção do relógio
                } catch (error) {
                    await showAlertModal({
                        title: 'Erro ao Aceitar',
                        message: `Erro ao aceitar solicitação: ${error.message}`,
                        icon: '❌'
                    });
                }
            }
        }

        // RECUSAR SOLICITACAO DE VOLUNTARIO DO RELOGIO
        if (target.classList.contains('btn-refuse-solicitacao')) {
            const id = target.dataset.id;
            if (!id) return;
            const confirmed = await showConfirmModal({
                title: 'Recusar Solicitação',
                message: 'Deseja recusar esta solicitação de voluntário?',
                confirmText: 'Recusar',
                confirmType: 'danger',
                icon: '🚫'
            });
            if (confirmed) {
                try {
                    const response = await fetch(`/api/admin/solicitacoes-oracao/${id}/recusar`, { method: 'POST' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Falha ao recusar solicitação');
                    
                    loadAdminSolicitacoes();
                    loadAdminSolicitacoesHistorico();
                } catch (error) {
                    await showAlertModal({
                        title: 'Erro ao Recusar',
                        message: `Erro ao recusar solicitação: ${error.message}`,
                        icon: '❌'
                    });
                }
            }
        }
        // Salvar Configurações Gerais
        if (target.id === 'save-general-settings') {
            handleGeneralSettingsSave();
            return;
        }

        // ADD Quadro
        if (target.id === 'btn-add-quadro') {
            const formHtml = `
                <input type="hidden" name="id_quadro" value=""> 
                <div class="form-group"><label for="qdt_data_inicial">Data de Início da Exibição</label><input type="date" id="qdt_data_inicial" name="qdt_data_inicial" required></div>
                <div class="form-group"><label for="qdt_data_final">Data de Fim da Exibição</label><input type="date" id="qdt_data_final" name="qdt_data_final" required></div>
                <div style="text-align: center; margin-top: 25px;">
                    <button type="submit" class="btn btn-dark">Salvar Quadro</button>
                </div>
            `;
            openFormModal('Adicionar Novo Quadro Tito', formHtml, handleQuadroSubmit);
            return;
        }

        // EDIT Quadro
        if (target.id === 'btn-edit-quadro') {
            const quadroId = document.getElementById('quadro-select').value;
            if (!quadroId) return;
            
            try {
                const res = await fetch(`/api/quadros/${quadroId}`);
                if (!res.ok) throw new Error('Quadro not found');
                const item = await res.json();
                const toInputDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

                const formHtml = `
                    <input type="hidden" name="id_quadro" value="${item.id_quadro}"> 
                    <div class="form-group"><label for="qdt_data_inicial">Data de Início</label><input type="date" id="qdt_data_inicial" name="qdt_data_inicial" value="${toInputDate(item.qdt_data_inicial)}" required></div>
                    <div class="form-group"><label for="qdt_data_final">Data de Fim</label><input type="date" id="qdt_data_final" name="qdt_data_final" value="${toInputDate(item.qdt_data_final)}" required></div>
                    <div class="form-button-group" style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 20px;">
                        <button type="button" id="btn-delete-quadro-modal" class="btn btn-delete">Excluir Quadro</button>
                        <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                    </div>
                `;
                openFormModal('Editar Quadro Tito', formHtml, handleQuadroSubmit);

                document.getElementById('btn-delete-quadro-modal').addEventListener('click', async () => {
                    const confirmed = await showConfirmModal({
                        title: 'Excluir Quadro Tito',
                        message: 'Tem certeza que deseja excluir este quadro? <strong>Todos os post-its associados a ele também serão removidos.</strong>',
                        confirmText: 'Sim, Excluir',
                        confirmType: 'danger',
                        icon: '🗑️'
                    });
                    if (confirmed) {
                        try {
                            const response = await fetch(`/api/quadros/${quadroId}`, { method: 'DELETE' });
                            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao excluir');
                            closeFormModal();
                            await showAlertModal({
                                title: 'Quadro Excluído',
                                message: 'O quadro foi excluído com sucesso!',
                                icon: '✅'
                            });
                            loadAdminTito(); // Recarrega o select de quadros
                        } catch (error) {
                            await showAlertModal({
                                title: 'Erro ao Excluir',
                                message: `Erro ao excluir: ${error.message}`,
                                icon: '❌'
                            });
                        }
                    }
                });
            } catch (error) {
                await showAlertModal({
                    title: 'Erro',
                    message: `Não foi possível carregar os dados do quadro: ${error.message}`,
                    icon: '❌'
                });
            }
            return;
        }

        // EDIT Relogio
        if (target.id === 'btn-edit-relogio') {
            const relogioId = document.getElementById('relogio-select').value;
            if (!relogioId) return;

            try {
                const res = await fetch(`/api/relogios/${relogioId}`);
                if (!res.ok) {
                    const errorResult = await res.json().catch(() => ({ error: 'Falha ao carregar os dados do relógio.' }));
                    throw new Error(errorResult.error || 'Relógio não encontrado');
                }
                const item = await res.json();

                const toInputDate = (dateString) => {
                    if (!dateString) return '';
                    return dateString.split('T')[0];
                };

                const formHtml = `
                    <input type="hidden" name="id_relogio" value="${item.id_relogio}">
                    <div class="form-group"><label for="rel_titulo">Título do Relógio</label><input type="text" id="rel_titulo" name="rel_titulo" value="${item.rel_titulo}" required></div>
                    <div class="form-group"><label for="rel_data_relogio">Data do Relógio</label><input type="date" id="rel_data_relogio" name="rel_data_relogio" value="${toInputDate(item.rel_data_relogio)}" required></div>
                    <div class="form-button-group" style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 20px;">
                        <button type="button" id="btn-delete-relogio-modal" class="btn btn-delete">Excluir Relógio</button>
                        <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                    </div>
                `;
                
                openFormModal('Editar Relógio', formHtml, handleRelogioSubmit);

                document.getElementById('btn-delete-relogio-modal').addEventListener('click', async () => {
                    const confirmed = await showConfirmModal({
                        title: 'Excluir Relógio de Oração',
                        message: 'Tem certeza que deseja excluir este relógio? <strong>Todos os voluntários e motivos associados a ele também serão removidos.</strong> Esta ação não pode ser desfeita.',
                        confirmText: 'Sim, Excluir',
                        confirmType: 'danger',
                        icon: '🗑️'
                    });
                    if (confirmed) {
                        try {
                            const response = await fetch(`/api/relogios/${relogioId}`, { method: 'DELETE' });
                            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao excluir');
                            closeFormModal();
                            await showAlertModal({
                                title: 'Relógio Excluído',
                                message: 'O relógio de oração foi excluído com sucesso!',
                                icon: '✅'
                            });
                            await loadAdminRelogios();
                            document.querySelector('#prayer-clock-table tbody').innerHTML = '<tr><td colspan="3">Selecione um relógio para ver os voluntários.</td></tr>';
                            document.getElementById('btn-add-volunteer').disabled = true;
                        } catch (error) {
                            await showAlertModal({
                                title: 'Erro ao Excluir',
                                message: `Erro ao excluir: ${error.message}`,
                                icon: '❌'
                            });
                        }
                    }
                });
            } catch(error) {
                await showAlertModal({
                    title: 'Erro',
                    message: `Não foi possível carregar os dados para edição: ${error.message}`,
                    icon: '❌'
                });
            }
            return;
        }

        // ADD Relogio
        if (target.id === 'btn-add-relogio') {
            const formHtml = `
                <input type="hidden" name="id_relogio" value=""> 
                <div class="form-group"><label for="rel_titulo">Título do Relógio</label><input type="text" id="rel_titulo" name="rel_titulo" required></div>
                <div class="form-group"><label for="rel_data_relogio">Data do Relógio</label><input type="date" id="rel_data_relogio" name="rel_data_relogio" required></div>
                <div style="text-align: center; margin-top: 25px;">
                    <button type="submit" class="btn btn-dark">Salvar Relógio</button>
                </div>
            `;
            openFormModal('Cadastrar Novo Relógio', formHtml, handleRelogioSubmit);
            return; // Para não prosseguir para outras verificações de clique
        }

        // ADD
        if (target.classList.contains('btn-add')) {
            const section = target.dataset.section;

            const toInputDate = (dateString) => {
                const date = dateString ? new Date(dateString) : new Date();
                const tzoffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                return new Date(date.getTime() - tzoffset).toISOString().split('T')[0];
            };

            if (section === 'news') {
                const formHtml = `
                    <input type="hidden" name="id_noticia" value=""> 
                    <div class="form-group"><label for="ntc_titulo">Título</label><input type="text" id="ntc_titulo" name="ntc_titulo" required></div>
                    <div class="form-group"><label for="ntc_corpo_mensagem">Corpo da Mensagem</label><textarea id="ntc_corpo_mensagem" name="ntc_corpo_mensagem" rows="15"></textarea></div>
                    <div class="form-group"><label for="ntc_data_publicacao">Data de Publicação</label><input type="date" id="ntc_data_publicacao" name="ntc_data_publicacao" value="${toInputDate()}" required></div>
                    <div class="form-group"><label for="ntc_imagem_fundo">Caminho da Imagem (ex: imagens/noticias/nova.jpg)</label><input type="text" id="ntc_imagem_fundo" name="ntc_imagem_fundo" required></div>
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="submit" class="btn btn-dark">Salvar</button>
                    </div>
                `;
                openFormModal('Adicionar Nova Notícia', formHtml, handleNewsSubmit);
                initializeTinyMCE('#ntc_corpo_mensagem');
            }
            if (section === 'missionaries') {
                const formHtml = `
                    <input type="hidden" name="id_missionario" value=""> 
                    <div class="form-group"><label for="mis_primeiro_nome">Primeiro Nome</label><input type="text" id="mis_primeiro_nome" name="mis_primeiro_nome" required></div>
                    <div class="form-group"><label for="mis_sobrenome">Sobrenome</label><input type="text" id="mis_sobrenome" name="mis_sobrenome" required></div>
                    <div class="form-group"><label for="mis_cidade">Cidade</label><input type="text" id="mis_cidade" name="mis_cidade"></div>
                    <div class="form-group"><label for="mis_pais">País</label><input type="text" id="mis_pais" name="mis_pais" required></div>
                    <div class="form-group"><label for="mis_imagem_url">URL da Imagem (ex: imagens/missionarios/nome.png)</label><input type="text" id="mis_imagem_url" name="mis_imagem_url"></div>
                    <div class="form-group"><label for="mis_data_nascimento">Data de Nascimento</label><input type="date" id="mis_data_nascimento" name="mis_data_nascimento"></div>
                    <div class="form-group"><label for="mis_descricao">Descrição Curta (Card)</label><textarea id="mis_descricao" name="mis_descricao" rows="3"></textarea></div> <!-- mis_descricao -->
                    <div class="form-group"><label for="mis_historia">História Completa (Modal - HTML)</label><textarea id="mis_historia" name="mis_historia" rows="6"></textarea></div> <!-- mis_historia -->
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="submit" class="btn btn-dark">Salvar Missionário</button>
                    </div>
                `;
                openFormModal('Adicionar Novo Missionário', formHtml, handleMissionarySubmit);
                initializeTinyMCE('#mis_descricao, #mis_historia');
            }
            if (section === 'events') {
                const formHtml = `
                    <input type="hidden" name="id_evento" value=""> 
                    <div class="form-group"><label for="evt_titulo">Título do Evento</label><input type="text" id="evt_titulo" name="evt_titulo" required></div>
                    <div class="form-group"><label for="evt_descricao">Descrição</label><textarea id="evt_descricao" name="evt_descricao" rows="4"></textarea></div>
                    <div class="form-group"><label for="evt_data_inicial">Data de Início</label><input type="date" id="evt_data_inicial" name="evt_data_inicial" required></div>
                    <div class="form-group"><label for="evt_data_final">Data de Fim</label><input type="date" id="evt_data_final" name="evt_data_final" required></div>
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="submit" class="btn btn-dark">Salvar Evento</button>
                    </div>
                `;
                openFormModal('Adicionar Novo Evento', formHtml, handleEventSubmit);
            }
            if (section === 'prayer-clock') {
                const relogioId = document.getElementById('relogio-select').value;
                if (!relogioId) {
                    alert('Por favor, selecione um relógio primeiro.');
                    return;
                }

                const hourOptions = generate15MinOptions('');
                const formHtml = `
                    <input type="hidden" name="id_voluntario" value="">
                    <input type="hidden" name="id_relogio" value="${relogioId}">
                    <div class="form-group"><label for="vol_nome_completo">Nome do Voluntário</label><input type="text" id="vol_nome_completo" name="vol_nome_completo" required></div>
                    <div class="form-group"><label for="vol_horario_escolhido">Horário (Ciclo de 15 min)</label><select id="vol_horario_escolhido" name="vol_horario_escolhido" required>${hourOptions}</select></div>
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="submit" class="btn btn-dark">Salvar Voluntário</button>
                    </div>
                `;
                openFormModal('Adicionar Novo Voluntário', formHtml, handlePrayerClockSubmit);
            }
            if (section === 'motivos-oracao') {
                const relogioId = document.getElementById('relogio-select').value;
                if (!relogioId) {
                    alert('Por favor, selecione um relógio primeiro.');
                    return;
                }

                // Busca os motivos existentes deste relógio para identificar ciclos já ocupados
                let existingMotivos = [];
                try {
                    const res = await fetch(`/api/motivos-oracao?relogioId=${relogioId}`);
                    if (res.ok) {
                        existingMotivos = await res.json();
                    }
                } catch (err) {
                    console.error('Erro ao buscar motivos existentes:', err);
                }

                const occupiedTimes = existingMotivos.map(m => m.mot_horario).filter(Boolean);
                const randomSlot = pickRandomAvailable15MinCycle(occupiedTimes);

                if (!randomSlot && occupiedTimes.length >= 96) {
                    alert('Todos os 96 ciclos de 15 minutos já possuem motivos de oração cadastrados neste relógio.');
                    return;
                }

                const cicloOptions = generate15MinOptions(randomSlot, true, occupiedTimes);
                const formHtml = `
                    <input type="hidden" name="id_motivo" value="">
                    <input type="hidden" name="id_relogio" value="${relogioId}">
                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <label for="mot_horario" style="margin-bottom: 0;">Ciclo de Horário (15 min)</label>
                            <button type="button" id="btn-sortear-ciclo" class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem; cursor: pointer;" title="Sortear outro horário disponível">🎲 Sortear outro</button>
                        </div>
                        <select id="mot_horario" name="mot_horario">${cicloOptions}</select>
                        <small style="color: #666; font-size: 0.8rem; display: block; margin-top: 4px;">Horário sugerido aleatoriamente entre os disponíveis. Você pode alterá-lo se desejar.</small>
                    </div>
                    <div class="form-group"><label for="mot_descricao">Motivo de Oração</label><textarea id="mot_descricao" name="mot_descricao" rows="5" required placeholder="Digite o motivo de oração para este ciclo..."></textarea></div>
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="submit" class="btn btn-dark">Salvar Motivo</button>
                    </div>
                `;
                openFormModal('Adicionar Motivo de Oração', formHtml, handleMotivoOracaoSubmit);

                const btnSortear = document.getElementById('btn-sortear-ciclo');
                const selectEl = document.getElementById('mot_horario');
                if (btnSortear && selectEl) {
                    btnSortear.addEventListener('click', () => {
                        const nextSlot = pickRandomAvailable15MinCycle(occupiedTimes);
                        if (nextSlot) {
                            selectEl.value = nextSlot;
                        }
                    });
                }
            }
            if (section === 'postits') {
                const quadroId = document.getElementById('quadro-select').value;
                if (!quadroId) {
                    alert('Por favor, selecione um quadro primeiro.');
                    return;
                }
                const quadrosOptions = await getQuadrosOptions(quadroId);
                const formHtml = `
                    <input type="hidden" name="id_postit" value=""> 
                    <div class="form-group"><label for="id_quadro">Associar ao Quadro</label><select id="id_quadro" name="id_quadro" required>${quadrosOptions}</select></div>
                    <div class="form-group"><label for="pst_conteudo">Conteúdo do Post-it</label><textarea id="pst_conteudo" name="pst_conteudo" rows="4" required></textarea></div>
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="submit" class="btn btn-dark">Salvar Post-it</button>
                    </div>
                `;
                openFormModal('Adicionar Novo Post-it', formHtml, handlePostitSubmit);
            }
        }

        // EDIT
        if (target.classList.contains('btn-edit')) {
            const id = target.dataset.id;
            const section = target.dataset.section;

            if (section === 'news') {
                try {
                    const res = await fetch(`/api/noticias/${id}`);
                    if (!res.ok) throw new Error('News item not found');
                    const item = await res.json();

                    const toInputDate = (dateString) => {
                        if (!dateString) return '';
                        const date = new Date(dateString);
                        const tzoffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                        return new Date(date.getTime() - tzoffset).toISOString().split('T')[0];
                    };

                    const formHtml = `
                        <input type="hidden" name="id_noticia" value="${item.id_noticia}"> 
                        <div class="form-group"><label for="ntc_titulo">Título</label><input type="text" id="ntc_titulo" name="ntc_titulo" value="${item.ntc_titulo}" required></div>
                        <div class="form-group"><label for="ntc_corpo_mensagem">Corpo da Mensagem</label><textarea id="ntc_corpo_mensagem" name="ntc_corpo_mensagem" rows="15">${item.ntc_corpo_mensagem || ''}</textarea></div>
                        <div class="form-group"><label for="ntc_data_publicacao">Data de Publicação</label><input type="date" id="ntc_data_publicacao" name="ntc_data_publicacao" value="${toInputDate(item.ntc_data_publicacao)}" required></div>
                        <div class="form-group"><label for="ntc_imagem_fundo">Caminho da Imagem</label><input type="text" id="ntc_imagem_fundo" name="ntc_imagem_fundo" value="${item.ntc_imagem_fundo}" required></div>
                        <div style="text-align: center; margin-top: 25px;">
                            <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                        </div>
                    `;
                    openFormModal('Editar Notícia', formHtml, handleNewsSubmit);
                    initializeTinyMCE('#ntc_corpo_mensagem');
                } catch(error) {
                    console.error('Error fetching news item for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
            if (section === 'missionaries') {
                try {
                    const res = await fetch(`/api/missionaries/${id}`);
                    if (!res.ok) throw new Error('Missionary not found');
                    const item = await res.json();

                    const formHtml = `
                        <input type="hidden" name="id_missionario" value="${item.id_missionario}">
                        <div class="form-group"><label for="mis_primeiro_nome">Primeiro Nome</label><input type="text" id="mis_primeiro_nome" name="mis_primeiro_nome" value="${item.mis_primeiro_nome || ''}" required></div>
                        <div class="form-group"><label for="mis_sobrenome">Sobrenome</label><input type="text" id="mis_sobrenome" name="mis_sobrenome" value="${item.mis_sobrenome || ''}" required></div>
                        <div class="form-group"><label for="mis_cidade">Cidade</label><input type="text" id="mis_cidade" name="mis_cidade" value="${item.mis_cidade || ''}"></div>
                        <div class="form-group"><label for="mis_pais">País</label><input type="text" id="mis_pais" name="mis_pais" value="${item.mis_pais || ''}" required></div>
                        <div class="form-group"><label for="mis_imagem_url">URL da Imagem</label><input type="text" id="mis_imagem_url" name="mis_imagem_url" value="${item.mis_imagem_url || ''}"></div>
                        <div class="form-group"><label for="mis_data_nascimento">Data de Nascimento</label><input type="date" id="mis_data_nascimento" name="mis_data_nascimento" value="${item.mis_data_nascimento ? item.mis_data_nascimento.split('T')[0] : ''}"></div>
                        <div class="form-group"><label for="mis_descricao">Descrição Curta (Card)</label><textarea id="mis_descricao" name="mis_descricao" rows="3">${item.mis_descricao || ''}</textarea></div> <!-- mis_descricao -->
                        <div class="form-group"><label for="mis_historia">História Completa (Modal - HTML)</label><textarea id="mis_historia" name="mis_historia" rows="6">${item.mis_historia || ''}</textarea></div> <!-- mis_historia -->
                        <div style="text-align: center; margin-top: 25px;">
                            <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                        </div>
                    `;
                    openFormModal('Editar Missionário', formHtml, handleMissionarySubmit);
                    initializeTinyMCE('#mis_descricao, #mis_historia');
                } catch(error) {
                    console.error('Error fetching missionary for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
            if (section === 'events') {
                try {
                    const res = await fetch(`/api/eventos/${id}`);
                    if (!res.ok) throw new Error('Event not found');
                    const item = await res.json();
                    const toInputDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

                    const formHtml = `
                        <input type="hidden" name="id_evento" value="${item.id_evento}"> 
                        <div class="form-group"><label for="evt_titulo">Título do Evento</label><input type="text" id="evt_titulo" name="evt_titulo" value="${escapeAttr(item.evt_titulo)}" required></div>
                        <div class="form-group"><label for="evt_descricao">Descrição</label><textarea id="evt_descricao" name="evt_descricao" rows="4">${item.evt_descricao || ''}</textarea></div>
                        <div class="form-group"><label for="evt_data_inicial">Data de Início</label><input type="date" id="evt_data_inicial" name="evt_data_inicial" value="${toInputDate(item.evt_data_inicial)}" required></div>
                        <div class="form-group"><label for="evt_data_final">Data de Fim</label><input type="date" id="evt_data_final" name="evt_data_final" value="${toInputDate(item.evt_data_final)}" required></div>
                        <div style="text-align: center; margin-top: 25px;">
                            <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                        </div>
                    `;
                    openFormModal('Editar Evento', formHtml, handleEventSubmit);
                } catch(error) {
                    console.error('Error fetching event for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
            if (section === 'prayer-clock') {
                try {
                    const res = await fetch(`/api/voluntarios/${id}`);
                    if (!res.ok) throw new Error('Volunteer not found');
                    const item = await res.json();
                    const hourOptions = generate15MinOptions(item.vol_horario_escolhido);

                    const formHtml = `
                        <input type="hidden" name="id_voluntario" value="${item.id_voluntario}"> 
                        <div class="form-group"><label for="vol_nome_completo">Nome do Voluntário</label><input type="text" id="vol_nome_completo" name="vol_nome_completo" value="${item.vol_nome_completo}" required></div>
                        <div class="form-group"><label for="vol_horario_escolhido">Horário (Ciclo de 15 min)</label><select id="vol_horario_escolhido" name="vol_horario_escolhido" required>${hourOptions}</select></div>
                        <div style="text-align: center; margin-top: 25px;">
                            <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                        </div>
                    `;
                    openFormModal('Editar Voluntário', formHtml, handlePrayerClockSubmit);
                } catch(error) {
                    console.error('Error fetching volunteer for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
            if (section === 'motivos-oracao') {
                 try {
                    const res = await fetch(`/api/motivos-oracao/${id}`);
                    if (!res.ok) throw new Error('Prayer request not found');
                    const item = await res.json();

                    // Busca motivos existentes para desabilitar horários ocupados por OUTROS motivos
                    let occupiedTimes = [];
                    try {
                        const allRes = await fetch(`/api/motivos-oracao?relogioId=${item.id_relogio}`);
                        if (allRes.ok) {
                            const allMotivos = await allRes.json();
                            occupiedTimes = allMotivos
                                .filter(m => m.id_motivo !== item.id_motivo)
                                .map(m => m.mot_horario)
                                .filter(Boolean);
                        }
                    } catch (err) {
                        console.error('Erro ao buscar motivos existentes:', err);
                    }

                    const cicloOptions = generate15MinOptions(item.mot_horario, true, occupiedTimes);
        
                    const formHtml = `
                        <input type="hidden" name="id_motivo" value="${item.id_motivo}"> 
                        <input type="hidden" name="id_relogio" value="${item.id_relogio}"> 
                        <div class="form-group"><label for="mot_horario">Ciclo de Horário (15 min)</label><select id="mot_horario" name="mot_horario">${cicloOptions}</select></div>
                        <div class="form-group"><label for="mot_descricao">Motivo de Oração</label><textarea id="mot_descricao" name="mot_descricao" rows="5" required>${item.mot_descricao}</textarea></div>
                        <div style="text-align: center; margin-top: 25px;">
                            <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                        </div>
                    `;
                    openFormModal('Editar Motivo de Oração', formHtml, handleMotivoOracaoSubmit);
                } catch(error) {
                    console.error('Error fetching prayer request for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
            if (section === 'postits') {
                 try {
                    const res = await fetch(`/api/postits/${id}`);
                    if (!res.ok) throw new Error('Post-it not found');
                    const item = await res.json();
                    const quadrosOptions = await getQuadrosOptions(item.id_quadro);

                    const formHtml = `
                        <input type="hidden" name="id_postit" value="${item.id_postit}"> 
                        <div class="form-group"><label for="id_quadro">Associar ao Quadro</label><select id="id_quadro" name="id_quadro" required>${quadrosOptions}</select></div>
                        <div class="form-group"><label for="pst_conteudo">Conteúdo do Post-it</label><textarea id="pst_conteudo" name="pst_conteudo" rows="4" required>${item.pst_conteudo}</textarea></div>
                        <div style="text-align: center; margin-top: 25px;">
                            <button type="submit" class="btn btn-dark">Salvar Alterações</button>
                        </div>
                    `;
                    openFormModal('Editar Post-it', formHtml, handlePostitSubmit);
                } catch(error) {
                    console.error('Error fetching post-it for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
        }

        // DELETE
        if (target.classList.contains('btn-delete')) {
            const id = target.dataset.id;
            const section = target.dataset.section;
            const confirmed = await showConfirmModal({
                title: 'Excluir Item',
                message: 'Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.',
                confirmText: 'Sim, Excluir',
                confirmType: 'danger',
                icon: '🗑️'
            });
            if (confirmed) {
                let url, loadFunction;
                switch(section) {
                    case 'news':
                        url = `/api/noticias/${id}`;
                        loadFunction = loadAdminNews;
                        break;
                    case 'missionaries':
                        url = `/api/missionaries/${id}`;
                        loadFunction = loadAdminMissionaries;
                        break;
                    case 'events':
                        url = `/api/eventos/${id}`;
                        loadFunction = loadAdminEvents;
                        break;
                    case 'prayer-clock':
                        url = `/api/voluntarios/${id}`;
                        loadFunction = () => {
                            const select = document.getElementById('relogio-select');
                            const relogioId = select.value;
                            if (!relogioId) return;

                            const selectedOption = select.options[select.selectedIndex];
                            const relogioDateString = selectedOption.dataset.date;

                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            const relogioDate = new Date(relogioDateString);
                            const correctedRelogioDate = new Date(relogioDate.getTime() + relogioDate.getTimezoneOffset() * 60000);
                            correctedRelogioDate.setHours(0, 0, 0, 0);

                            const isEditable = correctedRelogioDate >= today;
                            loadAdminPrayerClock(relogioId, isEditable);
                        };
                        break;
                    case 'motivos-oracao':
                        url = `/api/motivos-oracao/${id}`;
                        loadFunction = () => {
                            const select = document.getElementById('relogio-select');
                            const relogioId = select.value;
                            if (!relogioId) return;

                            const selectedOption = select.options[select.selectedIndex];
                            const relogioDateString = selectedOption.dataset.date;

                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            const relogioDate = new Date(relogioDateString);
                            const correctedRelogioDate = new Date(relogioDate.getTime() + relogioDate.getTimezoneOffset() * 60000);
                            correctedRelogioDate.setHours(0, 0, 0, 0);

                            const isEditable = correctedRelogioDate >= today;
                            loadAdminMotivosOracao(relogioId, isEditable);
                        };
                        break;
                    case 'postits':
                        url = `/api/postits/${id}`;
                        loadFunction = () => {
                            const select = document.getElementById('quadro-select');
                            const quadroId = select.value;
                            if (!quadroId) return;

                            const selectedOption = select.options[select.selectedIndex];
                            const endDateString = selectedOption.dataset.endDate;
                            
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            const endDate = new Date(endDateString);
                            const correctedEndDate = new Date(endDate.getTime() + endDate.getTimezoneOffset() * 60000);
                            correctedEndDate.setHours(0, 0, 0, 0);

                            const isEditable = correctedEndDate >= today;
                            loadAdminPostitsForQuadro(quadroId, isEditable);
                        };
                        break;
                    default:
                        return;
                }
                
                try {
                    const response = await fetch(url, { method: 'DELETE' });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Falha ao excluir o registro.');
                    }
                    loadFunction(); // Refresh the list
                } catch (error) {
                    console.error(`Error deleting item from ${section}:`, error);
                    await showAlertModal({
                        title: 'Erro ao Excluir',
                        message: `Ocorreu um erro ao excluir o item: ${error.message}`,
                        icon: '❌'
                    });
                }
            }
        }
    });

    async function handleNewsSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_noticia;
        
        // Pega o conteúdo HTML diretamente do editor TinyMCE
        const editor = tinymce.get('ntc_corpo_mensagem');
        if (editor) {
            data.ntc_corpo_mensagem = editor.getContent();
        }
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/noticias/${id}` : '/api/noticias';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            loadAdminNews(); // Refresh list on success
            return true;
        } catch (error) {
            console.error('Error submitting news form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }
    
    async function handleMissionarySubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_missionario;

        // Pega o conteúdo dos editores TinyMCE, pois eles não são enviados com o FormData
        const descEditor = tinymce.get('mis_descricao');
        if (descEditor) {
            data.mis_descricao = descEditor.getContent();
        }
        const histEditor = tinymce.get('mis_historia');
        if (histEditor) {
            data.mis_historia = histEditor.getContent();
        }
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/missionaries/${id}` : '/api/missionaries';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            loadAdminMissionaries();
            return true;
        } catch (error) {
            console.error('Error submitting missionary form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }

    async function handleEventSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_evento;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/eventos/${id}` : '/api/eventos';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            loadAdminEvents();
            return true;
        } catch (error) {
            console.error('Error submitting event form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }

    async function handlePrayerClockSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries()); // vol_nome_completo, vol_horario_escolhido
        const id = data.id_voluntario;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/voluntarios/${id}` : '/api/voluntarios';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            // Recarrega a lista de voluntários para o relógio selecionado
            const select = document.getElementById('relogio-select');
            const relogioId = select.value;
            if (relogioId) {
                const selectedOption = select.options[select.selectedIndex];
                const relogioDateString = selectedOption.dataset.date;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const relogioDate = new Date(relogioDateString);
                const correctedRelogioDate = new Date(relogioDate.getTime() + relogioDate.getTimezoneOffset() * 60000);
                correctedRelogioDate.setHours(0, 0, 0, 0);

                const isEditable = correctedRelogioDate >= today;
                loadAdminPrayerClock(relogioId, isEditable);
            }
            return true;
        } catch (error) {
            console.error('Error submitting prayer clock form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }

    async function handleQuadroSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries()); // qdt_data_inicial, qdt_data_final
        const id = data.id_quadro;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/quadros/${id}` : '/api/quadros';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            const newOrUpdatedId = id || (await response.json()).id;
            
            await loadAdminTito(); // Recarrega a lista de quadros
            const select = document.getElementById('quadro-select');
            select.value = newOrUpdatedId;
            select.dispatchEvent(new Event('change'));
            return true;
        } catch (error) {
            console.error('Error submitting quadro form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }

    async function handlePostitSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_postit;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/postits/${id}` : '/api/postits';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro no servidor');
            }
            const select = document.getElementById('quadro-select');
            const quadroId = select.value;
            if (quadroId) {
                const selectedOption = select.options[select.selectedIndex];
                const endDateString = selectedOption.dataset.endDate;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const endDate = new Date(endDateString);
                const correctedEndDate = new Date(endDate.getTime() + endDate.getTimezoneOffset() * 60000);
                correctedEndDate.setHours(0, 0, 0, 0);

                const isEditable = correctedEndDate >= today;
                loadAdminPostitsForQuadro(quadroId, isEditable);
            }
            return true;
        } catch (error) {
            console.error('Error submitting postit form:', error);
            alert(`Erro ao salvar: ${error.message}`);
            return false;
        }
    }

    // --- LÓGICA DO MODAL DE IMPORTAÇÃO DE MOTIVOS (.TXT) COM DISTRIBUIÇÃO ALEATÓRIA ---
    function initImportMotivosModal() {
        const modal = document.getElementById('modal-import-motivos');
        const openBtn = document.getElementById('btn-import-motivos');
        const closeBtn = document.getElementById('btn-close-import-modal');
        const cancelBtn = document.getElementById('btn-cancel-import');
        const confirmBtn = document.getElementById('btn-confirm-import');
        const fileInput = document.getElementById('import-file-input');
        const textPreview = document.getElementById('import-text-preview');
        const countBadge = document.getElementById('import-count-badge');
        const replaceCheckbox = document.getElementById('import-replace-checkbox');
        const relogioSelect = document.getElementById('relogio-select');

        if (!modal || !openBtn) return;

        function updateCount() {
            if (!textPreview || !countBadge) return;
            const lines = textPreview.value.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            const count = lines.length;
            countBadge.textContent = `${count} motivo${count === 1 ? '' : 's'} detectado${count === 1 ? '' : 's'}`;
            if (count > 0) {
                countBadge.style.background = '#e8f8f5';
                countBadge.style.color = '#117a65';
            } else {
                countBadge.style.background = '#eef2f7';
                countBadge.style.color = '#2c3e50';
            }
        }

        function closeModal() {
            modal.classList.remove('is-visible');
            modal.style.display = 'none';
            if (fileInput) fileInput.value = '';
            if (textPreview) textPreview.value = '';
            updateCount();
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<span>🎲</span> Distribuir Aleatoriamente';
            }
        }

        openBtn.addEventListener('click', () => {
            const relogioId = relogioSelect ? relogioSelect.value : null;
            if (!relogioId) {
                alert('Selecione primeiro um relógio de oração na lista acima.');
                return;
            }
            if (fileInput) fileInput.value = '';
            if (textPreview) textPreview.value = '';
            if (replaceCheckbox) replaceCheckbox.checked = true;
            updateCount();
            modal.style.display = 'flex';
            modal.classList.add('is-visible');
        });

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        if (textPreview) {
            textPreview.addEventListener('input', updateCount);
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target.result;
                    if (textPreview) {
                        textPreview.value = content;
                        updateCount();
                    }
                };
                reader.onerror = () => {
                    alert('Erro ao ler o arquivo .TXT selecionado.');
                };
                reader.readAsText(file);
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const relogioId = relogioSelect ? relogioSelect.value : null;
                if (!relogioId) {
                    alert('Nenhum relógio selecionado.');
                    return;
                }

                const rawText = textPreview ? textPreview.value : '';
                const motivos = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

                if (motivos.length === 0) {
                    await showAlertModal({
                        title: 'Nenhum motivo informado',
                        message: 'Por favor, envie um arquivo .TXT ou digite pelo menos um motivo de oração.',
                        icon: '⚠️'
                    });
                    return;
                }

                const replace = replaceCheckbox ? replaceCheckbox.checked : true;
                const confirmMsg = replace
                    ? `Deseja realmente substituir todos os motivos deste relógio e distribuir aleatoriamente os <strong>${motivos.length}</strong> motivos entre os ciclos de 15 minutos?`
                    : `Deseja distribuir aleatoriamente os <strong>${motivos.length}</strong> motivos nos ciclos disponíveis?`;

                const confirmed = await showConfirmModal({
                    title: 'Distribuir Motivos de Oração',
                    message: confirmMsg,
                    confirmText: 'Distribuir',
                    confirmType: 'primary',
                    icon: '🎲'
                });
                if (!confirmed) return;

                try {
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<span>⏳</span> Distribuindo...';

                    const response = await fetch(`/api/relogios/${relogioId}/import-motivos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ motivos, replace })
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Erro ao importar motivos de oração.');
                    }

                    closeModal();
                    await showAlertModal({
                        title: 'Sucesso',
                        message: result.message || 'Motivos importados e distribuídos com sucesso!',
                        icon: '✅'
                    });

                    // Recarrega a tabela de motivos do relógio
                    loadAdminMotivosOracao(relogioId, true);
                } catch (error) {
                    console.error('Erro na importação de motivos:', error);
                    await showAlertModal({
                        title: 'Falha na importação',
                        message: error.message,
                        icon: '❌'
                    });
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<span>🎲</span> Distribuir Aleatoriamente';
                }
            });
        }
    }

    initImportMotivosModal();

    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.innerText = new Date().getFullYear();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            // Fecha a conexão de atualização em tempo real ao fazer logout
            if (suggestionsEventSource) {
                suggestionsEventSource.close();
                console.log('Conexão SSE fechada ao fazer logout.');
            }
            try {
                await fetch('/api/logout', { method: 'POST' });
                window.location.reload(); // Recarrega a página para mostrar o modal de login
            } catch (error) {
                alert('Não foi possível fazer logout.');
            }
        });
    }
});