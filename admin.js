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
                    const hour = parseInt(item.vol_horario_escolhido.split(':')[0], 10);

                    const actionsHtml = isEditable
                        ? `<button class="btn-edit" data-id="${item.id_voluntario}" data-section="prayer-clock">Editar</button>
                           <button class="btn-delete" data-id="${item.id_voluntario}" data-section="prayer-clock">Excluir</button>`
                        : `<span>Visualização</span>`;

                    const row = `
                        <tr data-id="${item.id_voluntario}">
                            <td data-label="Horário">${String(hour).padStart(2, '0')}:00</td>
                            <td data-label="Nome do Voluntário" class="truncate-cell" title="${escapeAttr(item.vol_nome_completo)}">${item.vol_nome_completo}</td>
                            <td data-label="Ações">
                                ${actionsHtml}
                            </td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error loading prayer clock volunteers for admin:', error);
            tableBody.innerHTML = `<tr><td colspan="3">Falha ao carregar voluntários.</td></tr>`;
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
                tableBody.innerHTML = '<tr><td colspan="2">Nenhum motivo de oração cadastrado para este relógio.</td></tr>';
            } else {
                items.forEach(item => {
                    const actionsHtml = isEditable
                        ? `<button class="btn-edit" data-id="${item.id_motivo}" data-section="motivos-oracao">Editar</button>
                           <button class="btn-delete" data-id="${item.id_motivo}" data-section="motivos-oracao">Excluir</button>`
                        : `<span>Visualização</span>`;

                    const row = `
                        <tr data-id="${item.id_motivo}">
                            <td data-label="Motivo de Oração" class="truncate-cell" title="${escapeAttr(item.mot_descricao)}">${item.mot_descricao}</td>
                            <td data-label="Ações">
                                ${actionsHtml}
                            </td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
        } catch (error) {
            console.error('Error loading prayer requests for admin:', error);
            tableBody.innerHTML = `<tr><td colspan="2">Falha ao carregar motivos de oração.</td></tr>`;
        }
    }

    async function loadAdminRelogios() {
        const select = document.getElementById('relogio-select');
        const addVolunteerBtn = document.getElementById('btn-add-volunteer');
        const prayerClockTableBody = document.querySelector('#prayer-clock-table tbody');
        const editRelogioBtn = document.getElementById('btn-edit-relogio');
        const addMotivoBtn = document.getElementById('btn-add-motivo');
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
                const selectedId = selectedOption.value;

                // Reset buttons first
                addVolunteerBtn.disabled = true;
                addMotivoBtn.disabled = true;
                editRelogioBtn.style.display = 'none';
                
                if (selectedId) {
                    editRelogioBtn.style.display = 'inline-block'; // Show edit clock button
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
                    // No clock selected, clear tables
                    prayerClockTableBody.innerHTML = '<tr><td colspan="3">Selecione um relógio para ver os voluntários.</td></tr>';
                    motivosTableBody.innerHTML = '<tr><td colspan="2">Selecione um relógio para ver os motivos de oração.</td></tr>';
                }

                // Add/remove disabled class for visual styling
                [addVolunteerBtn, addMotivoBtn].forEach(btn => {
                    btn.disabled ? btn.classList.add('btn-disabled') : btn.classList.remove('btn-disabled');
                });
            });

            // Garante que os botões comecem desabilitados
            if (select.value === "") {
                editRelogioBtn.style.display = 'none';
                addMotivoBtn.disabled = true;
                addVolunteerBtn.disabled = true;
                [addVolunteerBtn, addMotivoBtn].forEach(btn => btn.classList.add('btn-disabled'));
            }

        } catch (error) {
            console.error('Error loading relogios for admin:', error);
            select.innerHTML = '<option value="">Falha ao carregar relógios</option>';
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
        } catch (error) {
            console.error('Error submitting relogio form:', error);
            alert(`Erro ao salvar: ${error.message}`);
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
        } catch (error) {
            console.error('Error submitting prayer request form:', error);
            alert(`Erro ao salvar: ${error.message}`);
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

    function initializeTinyMCE() {
        tinymce.init({
            selector: '#ntc_corpo_mensagem',
            plugins: 'lists link image media table code help wordcount',
            toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | link image | code',
            height: 350,
            menubar: false,
            language: 'pt_BR',
            language_url: 'https://cdn.jsdelivr.net/npm/tinymce-i18n@23.10.30/langs6/pt_BR.js', // Garante a tradução
            content_style: 'body { font-family:Roboto,sans-serif; font-size:14px }',
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
                await submitHandler(e);
                closeFormModal();
            };
        } else {
            // If no handler, just prevent default form submission and allow buttons inside to work
            dataForm.onsubmit = (e) => e.preventDefault();
        }
    }

    function closeFormModal() {
        // Remove qualquer instância ativa do TinyMCE para evitar conflitos
        const editor = tinymce.get('ntc_corpo_mensagem');
        if (editor) {
            editor.remove();
        }
        formModal.classList.remove('is-visible');
        document.body.classList.remove('modal-open');
        dataForm.innerHTML = '';
        dataForm.onsubmit = null;
    }

    modalCloseBtn.addEventListener('click', closeFormModal);

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
                // Se ainda não for encontrada após a atualização, informa o usuário.
                alert('Não foi possível encontrar os detalhes da sugestão. A lista foi atualizada, por favor, verifique se a sugestão ainda está pendente.');
            }
            return; // Stop further execution
        }

        // APROVAR SUGESTAO
        if (target.classList.contains('btn-approve')) {
            const id = target.dataset.id;
            if (!id) return;
            if (confirm('Aprovar esta sugestão? Um novo post-it será criado.')) {
                try {
                    const response = await fetch(`/api/admin/sugestoes/${id}/aprovar`, { method: 'POST' });
                    if (!response.ok) throw new Error((await response.json()).error || 'Falha ao aprovar');
                    
                    // Recarrega as listas
                    loadAdminSugestoes();
                    loadAdminSugestoesHistorico();
                    const quadroId = document.getElementById('quadro-select').value;
                    if (quadroId) {
                        const selectedOption = document.querySelector(`#quadro-select option[value="${quadroId}"]`);
                        const endDateString = selectedOption.dataset.endDate;
                        const today = new Date(); today.setHours(0,0,0,0);
                        const endDate = new Date(endDateString);
                        const isEditable = endDate >= today;
                        loadAdminPostitsForQuadro(quadroId, isEditable); // Recarrega post-its do quadro selecionado
                    }
                } catch (error) {
                    alert(`Erro ao aprovar: ${error.message}`);
                }
            }
        }

        // RECUSAR SUGESTAO
        if (target.classList.contains('btn-refuse')) {
            const id = target.dataset.id;
            if (!id) return;
            if (confirm('Recusar esta sugestão?')) {
                try {
                    const response = await fetch(`/api/admin/sugestoes/${id}/recusar`, { method: 'POST' });
                    if (!response.ok) throw new Error((await response.json()).error || 'Falha ao recusar');
                    loadAdminSugestoes();
                    loadAdminSugestoesHistorico();
                } catch (error) {
                    alert(`Erro ao recusar: ${error.message}`);
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
                    if (confirm('Tem certeza que deseja excluir este quadro? Todos os post-its associados a ele também serão removidos.')) {
                        try {
                            const response = await fetch(`/api/quadros/${quadroId}`, { method: 'DELETE' });
                            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao excluir');
                            alert('Quadro excluído com sucesso!');
                            closeFormModal();
                            loadAdminTito(); // Recarrega o select de quadros
                        } catch (error) {
                            alert(`Erro ao excluir: ${error.message}`);
                        }
                    }
                });
            } catch (error) {
                alert(`Não foi possível carregar os dados do quadro: ${error.message}`);
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
                    if (confirm('Tem certeza que deseja excluir este relógio? Todos os voluntários associados a ele também serão removidos. Esta ação não pode ser desfeita.')) {
                        try {
                            const response = await fetch(`/api/relogios/${relogioId}`, { method: 'DELETE' });
                            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao excluir');
                            alert('Relógio excluído com sucesso!');
                            closeFormModal();
                            await loadAdminRelogios();
                            document.querySelector('#prayer-clock-table tbody').innerHTML = '<tr><td colspan="3">Selecione um relógio para ver os voluntários.</td></tr>';
                            document.getElementById('btn-add-volunteer').disabled = true;
                        } catch (error) {
                            alert(`Erro ao excluir: ${error.message}`);
                        }
                    }
                });
            } catch(error) { alert(`Não foi possível carregar os dados para edição: ${error.message}`); }
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
                initializeTinyMCE();
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

                let hourOptions = '';
                for (let i = 0; i < 24; i++) {
                    hourOptions += `<option value="${i}">${String(i).padStart(2, '0')}:00</option>`;
                }
                const formHtml = `
                    <input type="hidden" name="id_voluntario" value="">
                    <input type="hidden" name="id_relogio" value="${relogioId}">
                    <div class="form-group"><label for="vol_nome_completo">Nome do Voluntário</label><input type="text" id="vol_nome_completo" name="vol_nome_completo" required></div>
                    <div class="form-group"><label for="vol_horario_escolhido">Horário</label><select id="vol_horario_escolhido" name="vol_horario_escolhido" required>${hourOptions}</select></div>
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
                const formHtml = `
                    <input type="hidden" name="id_motivo" value="">
                    <input type="hidden" name="id_relogio" value="${relogioId}">
                    <div class="form-group"><label for="mot_descricao">Motivo de Oração</label><textarea id="mot_descricao" name="mot_descricao" rows="5" required></textarea></div>
                    <div style="text-align: center; margin-top: 25px;">
                        <button type="submit" class="btn btn-dark">Salvar Motivo</button>
                    </div>
                `;
                openFormModal('Adicionar Motivo de Oração', formHtml, handleMotivoOracaoSubmit);
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
                    initializeTinyMCE();
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
                    const item = await res.json(); // vol_horario_escolhido, vol_nome_completo
                    const currentHour = parseInt(item.vol_horario_escolhido.split(':')[0], 10);

                    let hourOptions = '';
                    for (let i = 0; i < 24; i++) {
                        hourOptions += `<option value="${i}" ${i === currentHour ? 'selected' : ''}>${String(i).padStart(2, '0')}:00</option>`;
                    }

                    const formHtml = `
                        <input type="hidden" name="id_voluntario" value="${item.id_voluntario}"> 
                        <div class="form-group"><label for="vol_nome_completo">Nome do Voluntário</label><input type="text" id="vol_nome_completo" name="vol_nome_completo" value="${item.vol_nome_completo}" required></div>
                        <div class="form-group"><label for="vol_horario_escolhido">Horário</label><select id="vol_horario_escolhido" name="vol_horario_escolhido" required>${hourOptions}</select></div>
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
        
                    const formHtml = `
                        <input type="hidden" name="id_motivo" value="${item.id_motivo}"> 
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
            if (confirm('Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.')) {
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
                    if (!response.ok) throw new Error('Falha ao excluir');
                    loadFunction(); // Refresh the list
                } catch (error) {
                    console.error(`Error deleting item from ${section}:`, error);
                    alert('Ocorreu um erro ao excluir o item.');
                }
            }
        }
    });

    async function handleNewsSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        
        // Coleta os dados diretamente dos elementos do formulário para maior robustez
        const data = {
            id_noticia: form.querySelector('[name="id_noticia"]').value,
            ntc_titulo: document.getElementById('ntc_titulo').value,
            ntc_corpo_mensagem: '', // Será preenchido pelo TinyMCE
            ntc_data_publicacao: document.getElementById('ntc_data_publicacao').value,
            ntc_imagem_fundo: document.getElementById('ntc_imagem_fundo').value
        };
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
        } catch (error) {
            console.error('Error submitting news form:', error);
            alert(`Erro ao salvar: ${error.message}`);
        }
    }
    
    async function handleMissionarySubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_missionario;
        
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
        } catch (error) {
            console.error('Error submitting missionary form:', error);
            alert(`Erro ao salvar: ${error.message}`);
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
        } catch (error) {
            console.error('Error submitting event form:', error);
            alert(`Erro ao salvar: ${error.message}`);
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
        } catch (error) {
            console.error('Error submitting prayer clock form:', error);
            alert(`Erro ao salvar: ${error.message}`);
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

        } catch (error) {
            console.error('Error submitting quadro form:', error);
            alert(`Erro ao salvar: ${error.message}`);
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
        } catch (error) {
            console.error('Error submitting postit form:', error);
            alert(`Erro ao salvar: ${error.message}`);
        }
    }

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