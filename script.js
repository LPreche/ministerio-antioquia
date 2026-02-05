// Variável global para armazenar o agendamento (será preenchida pela API)
let prayerSchedule = [];

async function applyGlobalSettings() {
    try {
        const response = await fetch('/api/configuracoes');
        if (!response.ok) return false;
        const settings = await response.json();

        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // --- Maintenance Check ---
        const maintenanceModal = document.getElementById('maintenance-modal');
        let inMaintenance = false;
        if (maintenanceModal) {
            if (currentPage === 'noticias.html' && settings.cfg_manutencao_noticias) inMaintenance = true;
            if (currentPage === 'relogio.html' && settings.cfg_manutencao_relogio) inMaintenance = true;
            if (currentPage === 'quadro-tito.html' && settings.cfg_manutencao_quadrotito) inMaintenance = true;
        }

        if (inMaintenance) {
            document.body.classList.add('modal-open', 'in-maintenance');
            maintenanceModal.classList.add('is-visible');
            return true; // Indica que a página está em manutenção
        }

        // --- PIX Control ---
        if (currentPage === 'index.html') {
            const pixCard = Array.from(document.querySelectorAll('.donation-card')).find(card => card.querySelector('.pix-key'));
            if (pixCard) {
                if (settings.cfg_pix_ativo) {
                    pixCard.classList.remove('donation-card--disabled');
                } else {
                    pixCard.classList.add('donation-card--disabled');
                }
            }
        }
        return false; // Indica que a página NÃO está em manutenção
    } catch (error) {
        console.error('Could not apply global settings:', error);
        return false; // Em caso de erro, prossegue normalmente
    }
}

function updateFooter() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.innerText = new Date().getFullYear();
    }
}

function setupHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger-menu');
    const nav = document.querySelector('header nav');
    const body = document.body;

    if (!hamburger || !nav) return;

    const toggleMenu = () => {
        body.classList.toggle('nav-open');
        nav.classList.toggle('nav-open');
        const isExpanded = nav.classList.contains('nav-open');
        hamburger.setAttribute('aria-expanded', isExpanded);
    };

    hamburger.addEventListener('click', toggleMenu);

    // Fecha o menu hamburguer ao clicar em um link
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (body.classList.contains('nav-open')) {
                toggleMenu();
            }
        });
    });
}

function setupScrollAnimations() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    elements.forEach(element => observer.observe(element));
}

function setupMissionaryModal() {
    const modal = document.getElementById('missionary-modal');
    // Only run if the modal exists on the page
    if (!modal) return;

    const modalCloseBtn = modal.querySelector('.modal-close');
    const modalImg = modal.querySelector('#modal-img'); // Use querySelector para garantir que pega o do modal certo
    const modalName = document.getElementById('modal-name');
    const modalDescription = document.getElementById('modal-description');
    const body = document.body;
    const modalButton = modal.querySelector('.modal-contribute');

    // Using Event Delegation to handle clicks on static and dynamic cards
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.missionary-card');
        if (!card) return;

        const name = card.dataset.name;
        const imgSrc = card.dataset.imgSrc;
        const longDesc = card.dataset.longDesc;
        const btnText = card.dataset.btnText;
        const btnLink = card.dataset.btnLink;

        modalName.textContent = name;
        modalDescription.innerHTML = longDesc || ''; // Use innerHTML for potential HTML content
        modalImg.alt = `Foto de ${name}`;

        if (imgSrc) {
            modalImg.src = imgSrc;
            modalImg.parentElement.style.display = '';
        } else {
            modalImg.parentElement.style.display = 'none';
        }

        // Handle the button
        if (btnText && btnLink) {
            modalButton.textContent = btnText;
            modalButton.href = btnLink;
            modalButton.target = '_blank';
            modalButton.rel = 'noopener noreferrer';
        } else {
            // Default for dynamic missionaries
            modalButton.textContent = 'Contribuir';
            modalButton.href = 'index.html#doe-agora'; // Points to the donation section
            modalButton.removeAttribute('target');
            modalButton.removeAttribute('rel');
        }

        modal.classList.add('is-visible');
        body.classList.add('modal-open');
    });

    function closeModal() {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    modalCloseBtn.addEventListener('click', closeModal);
}

async function setupPrayerClock() {
    const clockFace = document.getElementById('clock-face');
    if (!clockFace) return; // Só executa na página do relógio

    const centerDisplay = document.getElementById('current-prayer');
    const clockTime = document.getElementById('clock');
    const clockHand = document.getElementById('clock-hand');
    const nameListContainer = document.getElementById('prayer-name-list');
    const motivesListContainer = document.querySelector('.prayer-requests-section ul');

    // --- Busca dados da API ---
    try {
        const response = await fetch('/api/relogio');
        if (response.ok) {
            const data = await response.json();
            
            // 1. Processar Voluntários
            // O banco retorna horario_escolhido como "HH:MM:SS". Precisamos extrair a hora.
            prayerSchedule = data.voluntarios.map(vol => { // vol_horario_escolhido, vol_nome_completo
                const hour = parseInt(vol.vol_horario_escolhido.split(':')[0], 10);
                return { hour: hour, name: vol.vol_nome_completo };
            });

            // Preencher horários vazios (caso o banco não tenha as 24h preenchidas)
            for (let i = 0; i < 24; i++) { // vol_horario_escolhido
                if (!prayerSchedule.find(p => p.hour === i)) {
                    prayerSchedule.push({ hour: i, name: "Disponível" });
                }
            }
            // Ordenar por horário
            prayerSchedule.sort((a, b) => a.hour - b.hour);

            // 2. Processar Motivos de Oração
            if (motivesListContainer && data.motivos) { // mot_descricao
                motivesListContainer.innerHTML = data.motivos.map(m => `<li>${m.mot_descricao}</li>`).join('');
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados do relógio:", error);
        // Fallback silencioso ou mensagem de erro na UI se desejar
    }

    const radius = clockFace.offsetWidth / 2 * 0.8; // 80% do raio para dar espaço

    let currentActiveName = "Carregando...";
    let lastUpdatedHour = -1;

    // Função para atualizar o texto central para o turno atual
    const updateDisplayToCurrent = () => {
        if (!centerDisplay) return;
        centerDisplay.textContent = `Turno de: ${currentActiveName}`;
    };

    // Renderiza os slots do relógio
    prayerSchedule.forEach(slot => {
        const angle = (slot.hour / 24) * 2 * Math.PI - (Math.PI / 2); // Ângulo em radianos, -90deg para começar no topo
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        const slotEl = document.createElement('div');
        slotEl.className = 'clock-slot';
        slotEl.textContent = String(slot.hour).padStart(2, '0');
        slotEl.dataset.hour = slot.hour;
        slotEl.dataset.name = slot.name;

        const transformValue = `translate(${x}px, ${y}px)`;
        slotEl.style.transform = transformValue;
        slotEl.style.setProperty('--transform-base', transformValue);

        // Interatividade no hover
        slotEl.addEventListener('mouseenter', () => {
            centerDisplay.textContent = `Turno de: ${slot.name}`;
        });

        clockFace.appendChild(slotEl);
    });

    // Renderiza a lista de nomes à esquerda
    if (nameListContainer) {
        prayerSchedule.forEach(slot => {
            const li = document.createElement('li');
            li.dataset.hour = slot.hour;
            li.innerHTML = `
                <span class="name">${slot.name}</span>
                <span class="hour">${String(slot.hour).padStart(2, '0')}:00</span>
            `;
            nameListContainer.appendChild(li);
        });
    }

    // Restaura o texto do turno atual quando o mouse sai do relógio
    clockFace.addEventListener('mouseleave', updateDisplayToCurrent);

    // Função principal que atualiza o estado do relógio a cada segundo
    function updateClockState() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentHour = now.getHours();

        if (clockTime) clockTime.textContent = `${hours}:${minutes}`;

        // Atualiza a rotação do ponteiro
        const rotationDegrees = (currentHour * 15) + (minutes * 0.25); // 15deg/hr, 0.25deg/min
        if (clockHand) clockHand.style.transform = `rotate(${rotationDegrees}deg)`;

        // Atualiza o nome do responsável pelo turno atual (para o efeito de hover-out)
        const activeSlotData = prayerSchedule.find(s => s.hour === currentHour);
        currentActiveName = activeSlotData ? activeSlotData.name : "Sem voluntário";

        // Para otimização, só atualiza as classes e scroll quando a hora muda
        if (currentHour !== lastUpdatedHour) {
            updateDisplayToCurrent();

            clockFace.querySelectorAll('.clock-slot').forEach(slotEl => {
                const slotHour = parseInt(slotEl.dataset.hour);
                slotEl.classList.remove('active', 'past');
                if (slotHour < currentHour) slotEl.classList.add('past');
                else if (slotHour === currentHour) slotEl.classList.add('active');
            });

            if (nameListContainer) {
                const currentActiveLi = nameListContainer.querySelector('li.active');
                if (currentActiveLi) currentActiveLi.classList.remove('active');
                const newActiveLi = nameListContainer.querySelector(`li[data-hour="${currentHour}"]`);
                if (newActiveLi) {
                    newActiveLi.classList.add('active');
                }
            }

            lastUpdatedHour = currentHour;
        }
    }

    updateClockState(); // Executa uma vez para definir o estado inicial
    updateDisplayToCurrent(); // Define o texto inicial
    setInterval(updateClockState, 1000); // Continua atualizando a cada segundo
}

function setupNewsModal() {
    const modal = document.getElementById('news-modal');
    if (!modal) return;

    const modalCloseBtn = modal.querySelector('.modal-close');
    const modalImg = modal.querySelector('#modal-img'); // Use querySelector para garantir que pega o do modal certo
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalFullStory = document.getElementById('modal-full-story');
    const body = document.body;

    // Usando Event Delegation para funcionar com elementos criados dinamicamente
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.news-card');
        if (!card) return;

        const newsId = card.dataset.id_noticia;
        if (!newsId) {
            console.error('ID da notícia não encontrado no card.');
            return;
        }

        // Busca os detalhes completos da notícia ao abrir o modal
        fetch(`/api/noticias/${newsId}`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch news details');
                return response.json();
            })
            .then(item => {
                modalTitle.textContent = item.ntc_titulo;
                modalFullStory.innerHTML = item.ntc_corpo_mensagem; // Isso renderizará o HTML corretamente

                let dataFormatada = '';
                if (item.ntc_data_publicacao) {
                    const data = new Date(item.ntc_data_publicacao);
                    dataFormatada = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                }

                if (dataFormatada) {
                    modalDate.textContent = `Publicado em: ${dataFormatada}`;
                    modalDate.style.display = 'block';
                } else {
                    modalDate.style.display = 'none';
                }

                if (item.ntc_imagem_fundo) {
                    modalImg.src = item.ntc_imagem_fundo;
                    modalImg.alt = `Imagem para: ${item.ntc_titulo}`;
                    modalImg.style.display = 'block';
                } else {
                    modalImg.style.display = 'none';
                }

                modal.classList.add('is-visible');
                body.classList.add('modal-open');
            })
            .catch(error => {
                console.error('Erro ao carregar detalhes da notícia:', error);
                alert('Não foi possível carregar os detalhes da notícia.');
            });
    });

    function closeModal() {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    modalCloseBtn.addEventListener('click', closeModal);
}

function setupBackToTopButton() {
    const backToTopButton = document.getElementById('back-to-top');
    if (!backToTopButton) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) { // Mostra o botão após 300px de rolagem
            backToTopButton.classList.add('show');
        } else {
            backToTopButton.classList.remove('show');
        }
    });

    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function setupContactForm() {
    const form = document.getElementById('contact-form');
    const modal = document.getElementById('thank-you-modal');

    if (!form || !modal) return; // Only run on contact page

    const closeBtn = modal.querySelector('.modal-close');
    const closeBtn2 = document.getElementById('close-thank-you-modal');
    const body = document.body;

    form.addEventListener('submit', function(e) {
        e.preventDefault(); // Prevent normal submission

        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Enviando...';
        submitButton.disabled = true;

        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                modal.classList.add('is-visible');
                body.classList.add('modal-open');
                form.reset(); // Limpa o formulário
            } else {
                response.json().then(data => {
                    const errorMessage = data.errors ? data.errors.map(e => e.message).join(', ') : 'Ocorreu um erro. Tente novamente.';
                    alert(`Erro ao enviar: ${errorMessage}`);
                }).catch(() => {
                    alert('Ocorreu um erro ao processar a resposta do servidor.');
                });
            }
        })
        .catch(error => {
            console.error('Fetch Error:', error);
            alert('Ocorreu um erro de rede. Verifique sua conexão e tente novamente.');
        })
        .finally(() => {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        });
    });

    function closeModal() {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    closeBtn.addEventListener('click', closeModal);
    closeBtn2.addEventListener('click', closeModal);
}

function setupPixModal() {
    const pixModal = document.getElementById('pix-modal');
    const openBtn = document.getElementById('open-pix-modal');

    // Só executa se os elementos existirem na página
    if (!pixModal || !openBtn) return;

    const closeBtn = pixModal.querySelector('.modal-close');
    const body = document.body;

    function openModal() {
        pixModal.classList.add('is-visible');
        body.classList.add('modal-open');
    }

    function closeModal() {
        pixModal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
}

function setupPixCopy() {
    const pixKeyElements = document.querySelectorAll('.pix-key');

    pixKeyElements.forEach(keyElement => {
        const originalText = keyElement.textContent.trim();
        keyElement.title = 'Clique para copiar a chave PIX';

        keyElement.addEventListener('click', () => {
            // Prevent multiple clicks while in "copied" state
            if (keyElement.dataset.copied) return;

            navigator.clipboard.writeText(originalText).then(() => {
                // --- Success Feedback ---
                keyElement.dataset.copied = 'true';
                keyElement.textContent = 'Copiado!';

                // Store original inline styles to revert them correctly
                const originalBg = keyElement.style.backgroundColor;
                const originalColor = keyElement.style.color;

                // Apply "copied" styles via JS to override any other styles (including inline)
                keyElement.style.backgroundColor = '#28a745'; // Success green
                keyElement.style.color = 'white';

                // Revert back after 2 seconds
                setTimeout(() => {
                    keyElement.textContent = originalText;
                    keyElement.style.backgroundColor = originalBg;
                    keyElement.style.color = originalColor;
                    delete keyElement.dataset.copied;
                }, 2000);
            }).catch(err => {
                console.error('Falha ao copiar a chave PIX:', err);
                alert('Não foi possível copiar a chave. Por favor, copie manualmente.');
            });
        });
    });
}

function setupCalendarExport() {
    // Verifica se está em um dispositivo com capacidade de toque, um bom proxy para celular.
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isMobile) {
        return; // Executa somente em dispositivos móveis.
    }

    const eventsGrid = document.querySelector('.events-grid');
    if (!eventsGrid) return;

    let pressTimer = null;

    const startPress = (e) => {
        const card = e.target.closest('.event-card');
        if (!card) return;

        // Inicia o timer de 2 segundos
        pressTimer = window.setTimeout(() => {
            pressTimer = null; // Limpa a referência do timer
            showCalendarConfirmationModal(card); // Ação de long-press
        }, 2000);
    };

    const cancelPress = () => {
        clearTimeout(pressTimer);
    };

    // Usa delegação de eventos no container dos eventos
    eventsGrid.addEventListener('touchstart', startPress, { passive: true });
    eventsGrid.addEventListener('touchend', cancelPress);
    eventsGrid.addEventListener('touchmove', cancelPress); // Cancela se o usuário começar a rolar
}

function showCalendarConfirmationModal(card) {
    const modal = document.getElementById('calendar-modal');
    const titleEl = document.getElementById('calendar-event-title');
    const yesBtn = document.getElementById('calendar-btn-yes');
    const closeBtn = modal.querySelector('.modal-close');
    const body = document.body;

    if (!modal || !titleEl || !yesBtn || !closeBtn) return;

    // Pega os dados do evento armazenados no card
    const eventTitle = card.dataset.evtTitle;
    const eventDesc = card.dataset.evtDesc;
    const eventStart = card.dataset.evtStart;
    const eventEnd = card.dataset.evtEnd;

    titleEl.textContent = eventTitle;

    const closeModal = () => {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
        // Limpa os listeners para evitar chamadas múltiplas
        yesBtn.onclick = null;
        closeBtn.onclick = null;
    };

    // Define as ações dos botões
    yesBtn.onclick = () => {
        generateIcsFile(eventTitle, eventDesc, eventStart, eventEnd);
        closeModal();
    };
    closeBtn.onclick = closeModal;

    // Exibe o modal
    modal.classList.add('is-visible');
    body.classList.add('modal-open');
}

function generateIcsFile(title, description, startDate, endDate) {
    // Helper para formatar a data para o padrão iCal (YYYYMMDD)
    const formatIcsDate = (dateString, isEnd = false) => {
        const date = new Date(dateString);
        // Corrige o fuso horário para garantir que a data não mude
        const correctedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
        
        if (isEnd) {
            // Para eventos de dia inteiro, a data final (DTEND) deve ser o dia seguinte ao fim do evento.
            correctedDate.setDate(correctedDate.getDate() + 1);
        }

        const year = correctedDate.getFullYear();
        const month = String(correctedDate.getMonth() + 1).padStart(2, '0');
        const day = String(correctedDate.getDate()).padStart(2, '0');
        
        return `${year}${month}${day}`;
    };

    // Monta o conteúdo do arquivo .ics
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MovimentoAntioquia//Website//PT',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@movimentoantioquia.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '')}`,
        `DTSTART;VALUE=DATE:${formatIcsDate(startDate)}`,
        `DTEND;VALUE=DATE:${formatIcsDate(endDate, true)}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${description.replace(/\n/g, '\\n')}`, // Escapa quebras de linha
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    // Cria um Blob e dispara o download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function loadNews() {
    const newsGrid = document.querySelector('.news-grid');
    if (!newsGrid) return; // Só executa na página de notícias

    try {
        const response = await fetch('/api/noticias');
        if (!response.ok) throw new Error('Erro na resposta da API');
        
        const noticias = await response.json();
        newsGrid.innerHTML = ''; // Limpa qualquer conteúdo existente

        noticias.forEach(noticia => {
            // 1. Formatar Data // ntc_data_publicacao
            let dataFormatada = '';
            if (noticia.ntc_data_publicacao) {
                const data = new Date(noticia.ntc_data_publicacao);
                dataFormatada = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
            }

            // 2. Gerar Preview do Texto (remove tags HTML e corta) // ntc_corpo_mensagem
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = noticia.ntc_corpo_mensagem;
            let textoPuro = tempDiv.textContent || tempDiv.innerText || '';
            let previewText = textoPuro.length > 150 ? textoPuro.substring(0, 150) + '...' : textoPuro;

            // 3. Criar Elemento HTML
            const card = document.createElement('div');
            card.className = 'news-card animate-on-scroll is-visible'; // Adiciona is-visible para aparecer imediatamente
            // Armazena apenas o ID no card para buscar os detalhes completos ao clicar
            card.dataset.id_noticia = noticia.id_noticia;

            card.innerHTML = `
                <div class="news-card-img-wrapper">
                    <img src="${noticia.ntc_imagem_fundo}" alt="${noticia.ntc_titulo}">
                </div>
                <div class="news-card-content">
                    <h4>${noticia.ntc_titulo}</h4>
                    <p class="news-card-preview">${previewText}</p>
                    <button class="btn-ver-mais">Ver mais +</button>
                </div>
            `;
            newsGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        newsGrid.innerHTML = '<p>Não foi possível carregar as notícias no momento.</p>';
    }
}

async function loadMissionaries() {
    const grid = document.querySelector('main .grid-2');
    // Only run on the missionaries page
    if (!grid || !window.location.pathname.includes('missionarios.html')) return;

    try {
        const response = await fetch('/api/missionaries');
        if (!response.ok) throw new Error('Erro na resposta da API de missionários');
        
        const missionaries = await response.json();

        const countryCodeMap = {
            'brasil': 'br', // mis_pais
            'japão': 'jp', // mis_pais
            'uruguai': 'uy' // mis_pais
        };

        missionaries.forEach(missionary => {
            const card = document.createElement('div');
            // Add classes for styling and animation
            card.className = 'missionary-card animate-on-scroll is-visible';
            // Set data attributes for the modal // mis_imagem_url, mis_descricao_longa
            card.dataset.name = missionary.nome; // nome é o CONCAT(mis_primeiro_nome, mis_sobrenome)
            card.dataset.imgSrc = missionary.mis_imagem_url; // mis_imagem_url
            card.dataset.longDesc = missionary.mis_historia; // mis_historia

            // Simple logic to get country code for flag // mis_pais
            const countryCode = countryCodeMap[missionary.mis_pais.toLowerCase()] || missionary.mis_pais.toLowerCase().slice(0, 2);

            // Use mis_descricao for the short description on the card
            let shortDesc = missionary.mis_descricao || '';
            // If mis_descricao is too long, truncate it
            if (shortDesc.length > 150) {
                shortDesc = shortDesc.substring(0, 147) + '...';
            } else if (shortDesc.length === 0 && missionary.mis_historia) { // Fallback if mis_descricao is empty but mis_historia exists
                shortDesc = missionary.mis_historia.substring(0, Math.min(missionary.mis_historia.length, 147)) + (missionary.mis_historia.length > 147 ? '...' : '');
            }

            card.innerHTML = `
                <div class="missionary-flag">
                    <img src="https://flagcdn.com/${countryCode}.svg" alt="Bandeira de ${missionary.mis_pais}">
                </div>
                <div class="missionary-img-wrapper">
                    <img src="${missionary.mis_imagem_url || ''}" alt="Foto de ${missionary.nome}">
                </div>
                <h4>${missionary.nome}</h4>
                <p>${shortDesc}</p>
            `;
            
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Erro ao carregar missionários:', error);
        grid.insertAdjacentHTML('beforeend', '<p>Não foi possível carregar os missionários no momento.</p>');
    }
}

async function loadTitusBoard() {
    const titusBoard = document.querySelector('.titus-board');
    if (!titusBoard) return; // Só executa na página do quadro

    const titusGrid = titusBoard.querySelector('.titus-board-grid');
    if (!titusGrid) return;

    try {
        const response = await fetch('/api/tito');
        if (!response.ok) throw new Error('Erro na resposta da API');
        
        const { board, postIts } = await response.json();
        titusGrid.innerHTML = ''; // Limpa conteúdo

        // Remove o display de período anterior, se houver
        const existingPeriodDisplay = document.querySelector('.titus-period-container');
        if (existingPeriodDisplay) {
            existingPeriodDisplay.remove();
        }

        if (!board) {
            titusGrid.innerHTML = '<p style="color: white; grid-column: 1 / -1; text-align: center;">Não há ensinamentos ativos no quadro no momento.</p>';
            return;
        }

        // Exibe o período do quadro do lado de fora
        const formatDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            // Adjust for timezone to show the correct local date
            return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        const periodContainer = document.createElement('div');
        periodContainer.className = 'titus-period-container';
        periodContainer.style.textAlign = 'center';
        periodContainer.style.marginBottom = '30px';
        periodContainer.innerHTML = `<div class="titus-period-display"><strong>Período ativo:</strong> ${formatDate(board.qdt_data_inicial)} a ${formatDate(board.qdt_data_final)}</div>`;
        titusBoard.parentNode.insertBefore(periodContainer, titusBoard);

        if (postIts.length === 0) {
            titusGrid.innerHTML = '<p style="color: white; grid-column: 1 / -1; text-align: center;">Nenhum post-it cadastrado para este período.</p>';
            return;
        }

        postIts.forEach((postIt, index) => {
            const colorClass = `color-${(index % 5) + 1}`;
            const card = document.createElement('div');
            card.className = `post-it ${colorClass}`;
            
            card.innerHTML = `
                <p class="post-it-text">${postIt.pst_conteudo}</p>
            `;
            titusGrid.appendChild(card);
        });

        // Força a re-animação se o quadro já estiver visível
        if (titusBoard.classList.contains('is-visible')) {
            // Um pequeno truque para reiniciar a animação em cascata
            titusBoard.classList.remove('is-visible');
            setTimeout(() => titusBoard.classList.add('is-visible'), 50);
        }

    } catch (error) {
        console.error('Erro ao carregar Quadro Tito:', error);
        titusGrid.innerHTML = '<p style="color: white; grid-column: 1 / -1; text-align: center;">Não foi possível carregar os post-its no momento.</p>';
    }
}

async function loadPublicEvents() {
    const eventsGrid = document.querySelector('.events-grid');
    if (!eventsGrid) return;

    try {
        const response = await fetch('/api/eventos');
        if (!response.ok) throw new Error('Failed to fetch events');
        let events = await response.json();

        // Filtra por eventos futuros
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normaliza para o início do dia
        events = events.filter(event => {
            const eventEndDate = new Date(event.evt_data_final);
            return eventEndDate >= today;
        });

        // Ordena por data de início
        events.sort((a, b) => new Date(a.evt_data_inicial) - new Date(b.evt_data_inicial));

        eventsGrid.innerHTML = ''; // Limpa conteúdo estático

        if (events.length === 0) {
            eventsGrid.innerHTML = '<p>Nenhum evento programado no momento.</p>';
            return;
        }

        events.forEach((event, index) => {
            const startDate = new Date(event.evt_data_inicial);
            const endDate = new Date(event.evt_data_final);
            
            // Ajusta para o fuso horário para pegar a data local correta
            const correctedStartDate = new Date(startDate.getTime() + startDate.getTimezoneOffset() * 60000);
            const correctedEndDate = new Date(endDate.getTime() + endDate.getTimezoneOffset() * 60000);

            const startDay = String(correctedStartDate.getDate()).padStart(2, '0');
            const startMonth = correctedStartDate.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
            
            const endDay = String(correctedEndDate.getDate()).padStart(2, '0');
            const endMonth = correctedEndDate.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');

            const isSameDay = correctedStartDate.toDateString() === correctedEndDate.toDateString();

            let dateHtml = '';
            if (isSameDay) {
                dateHtml = `
                    <div class="event-date">
                        <span class="event-day">${startDay}</span>
                        <span class="event-month">${startMonth}</span>
                    </div>
                `;
            } else {
                dateHtml = `
                    <div class="event-date-range">
                        <div class="event-date">
                            <span class="event-day">${startDay}</span>
                            <span class="event-month">${startMonth}</span>
                        </div>
                        <span class="date-separator">-</span>
                        <div class="event-date">
                            <span class="event-day">${endDay}</span>
                            <span class="event-month">${endMonth}</span>
                        </div>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = 'event-card';
            if (index === 0) {
                card.classList.add('event-card--next');
            }
            // Adiciona os dados do evento ao card para serem usados na exportação do calendário
            card.dataset.evtTitle = event.evt_titulo;
            card.dataset.evtDesc = event.evt_descricao || '';
            card.dataset.evtStart = event.evt_data_inicial;
            card.dataset.evtEnd = event.evt_data_final;

            card.innerHTML = `
                ${dateHtml}
                <div class="event-details">
                    <h4 class="event-title">${event.evt_titulo}</h4>
                    <p class="event-description">${event.evt_descricao || ''}</p>
                </div>
            `;
            eventsGrid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading public events:', error);
        eventsGrid.innerHTML = '<p>Não foi possível carregar os eventos no momento.</p>';
    }
}

function setupTitusWarningModal() {
    // Só executa na página do quadro tito
    if (!document.querySelector('.titus-board')) return;

    const modal = document.getElementById('titus-warning-modal');
    if (!modal) return;

    const okBtn = document.getElementById('titus-warning-ok');
    const body = document.body;

    function closeModal() {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    // Mostra o modal em telas de tablet ou menores
    if (window.innerWidth <= 992) {
        modal.classList.add('is-visible');
        body.classList.add('modal-open');
    }

    okBtn.addEventListener('click', closeModal);
}

function setupAdminRedirect() {
    const brandName = document.querySelector('.brand-name');
    if (!brandName) return;

    let pressTimer;

    const startPress = (e) => {
        // Previne comportamento padrão em touch, como scroll
        e.preventDefault();
        pressTimer = window.setTimeout(() => {
            window.location.href = 'admin.html';
        }, 5000); // 5 segundos
    };

    const cancelPress = () => {
        clearTimeout(pressTimer);
    };

    brandName.addEventListener('mousedown', startPress);
    brandName.addEventListener('mouseup', cancelPress);
    brandName.addEventListener('mouseleave', cancelPress);
    brandName.addEventListener('touchstart', startPress, { passive: false });
    brandName.addEventListener('touchend', cancelPress);
}

// --- Inicialização de todas as funções ---
(async () => {
    const inMaintenance = await applyGlobalSettings();
    if (inMaintenance) return; // Para a execução do script se a página estiver em manutenção

    updateFooter();
    setupHamburgerMenu();
    setupScrollAnimations();
    setupMissionaryModal();
    setupBackToTopButton();
    setupNewsModal();
    setupPrayerClock();
    setupContactForm();
    setupPixModal();
    setupPixCopy();
    setupCalendarExport(); // Adiciona a lógica para exportar para o calendário
    loadNews();
    loadMissionaries();
    loadTitusBoard();
    setupTitusWarningModal();
    loadPublicEvents();
    setupAdminRedirect(); // Adiciona o listener para o redirecionamento secreto
})();