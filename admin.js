document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const adminDashboard = document.getElementById('admin-dashboard');
    const adminHeader = document.getElementById('admin-header');
    const adminFooter = document.getElementById('admin-footer');
    // Se você adicionar um botão de logout no seu admin.html com id="logout-btn", este código irá funcionar.
    const logoutBtn = document.getElementById('logout-btn');

    // --- LOGIN LOGIC ---
    function showDashboard() {
        loginModal.classList.remove('is-visible');
        adminDashboard.style.display = 'block';
        adminHeader.style.display = 'flex';
        adminFooter.style.display = 'block';
        
        // Load initial data
        loadAdminNews();
        loadAdminMissionaries();
        loadAdminPrayerClock();
        loadAdminQuadros();
        loadAdminPostits();
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
                        <td data-label="Título">${item.ntc_titulo}</td>
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
                        <td data-label="Nome">${item.nome}</td>
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

    async function loadAdminPrayerClock() {
        try {
            const response = await fetch('/api/voluntarios');
            if (!response.ok) throw new Error('Failed to fetch volunteers');
            const items = await response.json();
            
            const tableBody = document.querySelector('#prayer-clock-table tbody');
            tableBody.innerHTML = '';

            items.forEach(item => {
                const hour = parseInt(item.vol_horario_escolhido.split(':')[0], 10);
                const row = `
                    <tr data-id="${item.id_voluntario}">
                        <td data-label="Horário">${String(hour).padStart(2, '0')}:00</td>
                        <td data-label="Nome do Voluntário">${item.vol_nome_completo}</td>
                        <td data-label="Ações">
                            <button class="btn-edit" data-id="${item.id_voluntario}" data-section="prayer-clock">Editar</button>
                            <button class="btn-delete" data-id="${item.id_voluntario}" data-section="prayer-clock">Excluir</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading prayer clock volunteers for admin:', error);
            document.querySelector('#prayer-clock-table tbody').innerHTML = `<tr><td colspan="3">Falha ao carregar voluntários.</td></tr>`;
        }
    }

    async function loadAdminQuadros() {
        try {
            const response = await fetch('/api/admin/quadros');
            if (!response.ok) throw new Error('Failed to fetch quadros');
            const items = await response.json();
            
            const tableBody = document.querySelector('#quadros-table tbody');
            tableBody.innerHTML = '';

            const formatDate = (dateString) => {
                if (!dateString) return 'N/A';
                const date = new Date(dateString);
                return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
            };

            items.forEach(item => {
                const row = `
                    <tr data-id="${item.id_quadro}">
                        <td data-label="Título do Quadro">${item.qdt_titulo}</td>
                        <td data-label="Data Inicial">${formatDate(item.qdt_data_inicial)}</td>
                        <td data-label="Data Final">${formatDate(item.qdt_data_final)}</td>
                        <td data-label="Ações">
                            <button class="btn-edit" data-id="${item.id_quadro}" data-section="quadros">Editar</button>
                            <button class="btn-delete" data-id="${item.id_quadro}" data-section="quadros">Excluir</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading quadros for admin:', error);
            document.querySelector('#quadros-table tbody').innerHTML = `<tr><td colspan="4">Falha ao carregar quadros.</td></tr>`;
        }
    }

    async function loadAdminPostits() {
        try {
            const response = await fetch('/api/admin/postits');
            if (!response.ok) throw new Error('Failed to fetch postits');
            const items = await response.json();
            
            const tableBody = document.querySelector('#postits-table tbody');
            tableBody.innerHTML = '';

            items.forEach(item => {
                const row = `
                    <tr data-id="${item.id_postit}">
                        <td data-label="Conteúdo">${item.pst_conteudo}</td>
                        <td data-label="Quadro Associado">${item.qdt_titulo || 'Nenhum'}</td>
                        <td data-label="Ações">
                            <button class="btn-edit" data-id="${item.id_postit}" data-section="postits">Editar</button>
                            <button class="btn-delete" data-id="${item.id_postit}" data-section="postits">Excluir</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } catch (error) {
            console.error('Error loading postits for admin:', error);
            document.querySelector('#postits-table tbody').innerHTML = `<tr><td colspan="3">Falha ao carregar post-its.</td></tr>`;
        }
    }

    // Helper para buscar quadros e gerar as opções para um <select>
    async function getQuadrosOptions(selectedId = null) {
        try {
            const response = await fetch('/api/admin/quadros');
            if (!response.ok) return '<option value="">Erro ao carregar quadros</option>';
            const quadros = await response.json();
            
            let optionsHtml = '<option value="">Selecione um quadro</option>';
            quadros.forEach(quadro => {
                optionsHtml += `<option value="${quadro.id_quadro}" ${quadro.id_quadro == selectedId ? 'selected' : ''}>${quadro.qdt_titulo}</option>`;
            });
            return optionsHtml;
        } catch (error) {
            return '<option value="">Erro ao carregar quadros</option>';
        }
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

        dataForm.onsubmit = async (e) => {
            e.preventDefault();
            await submitHandler(e);
            closeFormModal();
        };
    }

    function closeFormModal() {
        formModal.classList.remove('is-visible');
        document.body.classList.remove('modal-open');
        dataForm.innerHTML = '';
        dataForm.onsubmit = null;
    }

    modalCloseBtn.addEventListener('click', closeFormModal);
    formModal.addEventListener('click', e => e.target === formModal && closeFormModal());

    // --- EVENT DELEGATION FOR ADD/EDIT/DELETE ---
    adminDashboard.addEventListener('click', async (e) => {
        const target = e.target;

        // ADD
        if (target.classList.contains('btn-add')) {
            const section = target.dataset.section;
            if (section === 'news') {
                const formHtml = `
                    <input type="hidden" name="id_noticia" value=""> 
                    <div class="form-group"><label for="ntc_titulo">Título</label><input type="text" id="ntc_titulo" name="ntc_titulo" required></div>
                    <div class="form-group"><label for="ntc_corpo_mensagem">Corpo da Mensagem (HTML)</label><textarea id="ntc_corpo_mensagem" name="ntc_corpo_mensagem" rows="8" required></textarea></div>
                    <div class="form-group"><label for="ntc_imagem_fundo">Caminho da Imagem (ex: imagens/noticias/nova.jpg)</label><input type="text" id="ntc_imagem_fundo" name="ntc_imagem_fundo" required></div>
                    <button type="submit" class="btn">Salvar</button>
                `;
                openFormModal('Adicionar Nova Notícia', formHtml, handleNewsSubmit);
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
                    <button type="submit" class="btn">Salvar Missionário</button>
                `;
                openFormModal('Adicionar Novo Missionário', formHtml, handleMissionarySubmit);
            }
            if (section === 'prayer-clock') {
                let hourOptions = '';
                for (let i = 0; i < 24; i++) {
                    hourOptions += `<option value="${i}">${String(i).padStart(2, '0')}:00</option>`;
                }
                const formHtml = `
                    <input type="hidden" name="id_voluntario" value="">
                    <div class="form-group"><label for="vol_nome_completo">Nome do Voluntário</label><input type="text" id="vol_nome_completo" name="vol_nome_completo" required></div>
                    <div class="form-group"><label for="vol_horario_escolhido">Horário</label><select id="vol_horario_escolhido" name="vol_horario_escolhido" required>${hourOptions}</select></div>
                    <button type="submit" class="btn">Salvar Voluntário</button>
                `;
                openFormModal('Adicionar Novo Voluntário', formHtml, handlePrayerClockSubmit);
            }
            if (section === 'quadros') {
                const formHtml = `
                    <input type="hidden" name="id_quadro" value=""> 
                    <div class="form-group"><label for="qdt_titulo">Título do Quadro</label><input type="text" id="qdt_titulo" name="qdt_titulo" required></div>
                    <div class="form-group"><label for="qdt_data_inicial">Data de Início da Exibição</label><input type="date" id="qdt_data_inicial" name="qdt_data_inicial" required></div>
                    <div class="form-group"><label for="qdt_data_final">Data de Fim da Exibição</label><input type="date" id="qdt_data_final" name="qdt_data_final" required></div>
                    <button type="submit" class="btn">Salvar Quadro</button>
                `;
                openFormModal('Adicionar Novo Quadro', formHtml, handleQuadroSubmit);
            }
            if (section === 'postits') {
                const quadrosOptions = await getQuadrosOptions();
                const formHtml = `
                    <input type="hidden" name="id_postit" value=""> 
                    <div class="form-group"><label for="id_quadro">Associar ao Quadro</label><select id="id_quadro" name="id_quadro" required>${quadrosOptions}</select></div>
                    <div class="form-group"><label for="pst_conteudo">Conteúdo do Post-it</label><textarea id="pst_conteudo" name="pst_conteudo" rows="4" required></textarea></div>
                    <button type="submit" class="btn">Salvar Post-it</button>
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

                    const formHtml = `
                        <input type="hidden" name="id_noticia" value="${item.id_noticia}"> 
                        <div class="form-group"><label for="ntc_titulo">Título</label><input type="text" id="ntc_titulo" name="ntc_titulo" value="${item.ntc_titulo}" required></div>
                        <div class="form-group"><label for="ntc_corpo_mensagem">Corpo da Mensagem (HTML)</label><textarea id="ntc_corpo_mensagem" name="ntc_corpo_mensagem" rows="8" required>${item.ntc_corpo_mensagem}</textarea></div>
                        <div class="form-group"><label for="ntc_imagem_fundo">Caminho da Imagem</label><input type="text" id="ntc_imagem_fundo" name="ntc_imagem_fundo" value="${item.ntc_imagem_fundo}" required></div>
                        <button type="submit" class="btn">Salvar Alterações</button>
                    `;
                    openFormModal('Editar Notícia', formHtml, handleNewsSubmit);
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
                        <button type="submit" class="btn">Salvar Alterações</button>
                    `;
                    openFormModal('Editar Missionário', formHtml, handleMissionarySubmit);
                } catch(error) {
                    console.error('Error fetching missionary for edit:', error);
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
                        <button type="submit" class="btn">Salvar Alterações</button>
                    `;
                    openFormModal('Editar Voluntário', formHtml, handlePrayerClockSubmit);
                } catch(error) {
                    console.error('Error fetching volunteer for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
            if (section === 'quadros') {
                 try {
                    const res = await fetch(`/api/admin/quadros/${id}`);
                    if (!res.ok) throw new Error('Quadro not found');
                    const item = await res.json();

                    const toInputDate = (dateString) => {
                        if (!dateString) return '';
                        return dateString.split('T')[0];
                    };

                    const formHtml = `
                        <input type="hidden" name="id_quadro" value="${item.id_quadro}"> 
                        <div class="form-group"><label for="qdt_titulo">Título do Quadro</label><input type="text" id="qdt_titulo" name="qdt_titulo" value="${item.qdt_titulo}" required></div>
                        <div class="form-group"><label for="qdt_data_inicial">Data de Início da Exibição</label><input type="date" id="qdt_data_inicial" name="qdt_data_inicial" value="${toInputDate(item.qdt_data_inicial)}" required></div>
                        <div class="form-group"><label for="qdt_data_final">Data de Fim da Exibição</label><input type="date" id="qdt_data_final" name="qdt_data_final" value="${toInputDate(item.qdt_data_final)}" required></div>
                        <button type="submit" class="btn">Salvar Alterações</button>
                    `;
                    openFormModal('Editar Quadro', formHtml, handleQuadroSubmit);
                } catch(error) {
                    console.error('Error fetching quadro for edit:', error);
                    alert('Não foi possível carregar os dados para edição.');
                }
            }
            if (section === 'postits') {
                 try {
                    const res = await fetch(`/api/admin/postits/${id}`);
                    if (!res.ok) throw new Error('Post-it not found');
                    const item = await res.json();
                    const quadrosOptions = await getQuadrosOptions(item.id_quadro);

                    const formHtml = `
                        <input type="hidden" name="id_postit" value="${item.id_postit}"> 
                        <div class="form-group"><label for="id_quadro">Associar ao Quadro</label><select id="id_quadro" name="id_quadro" required>${quadrosOptions}</select></div>
                        <div class="form-group"><label for="pst_conteudo">Conteúdo do Post-it</label><textarea id="pst_conteudo" name="pst_conteudo" rows="4" required>${item.pst_conteudo}</textarea></div>
                        <button type="submit" class="btn">Salvar Alterações</button>
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
                    case 'prayer-clock':
                        url = `/api/voluntarios/${id}`;
                        loadFunction = loadAdminPrayerClock;
                        break;
                    case 'quadros':
                        url = `/api/admin/quadros/${id}`;
                        loadFunction = () => { loadAdminQuadros(); loadAdminPostits(); }; // Recarrega ambos
                        break;
                    case 'postits':
                        url = `/api/admin/postits/${id}`;
                        loadFunction = loadAdminPostits;
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
        const data = Object.fromEntries(formData.entries()); // ntc_titulo, ntc_corpo_mensagem, ntc_imagem_fundo
        const id = data.id_noticia;
        
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
            loadAdminPrayerClock();
        } catch (error) {
            console.error('Error submitting prayer clock form:', error);
            alert(`Erro ao salvar: ${error.message}`);
        }
    }

    async function handleQuadroSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id_quadro;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/admin/quadros/${id}` : '/api/admin/quadros';

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
            loadAdminQuadros();
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
        const url = id ? `/api/admin/postits/${id}` : '/api/admin/postits';

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
            loadAdminPostits();
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
            try {
                await fetch('/api/logout', { method: 'POST' });
                window.location.reload(); // Recarrega a página para mostrar o modal de login
            } catch (error) {
                alert('Não foi possível fazer logout.');
            }
        });
    }
});