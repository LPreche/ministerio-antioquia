// Variável global para armazenar o agendamento (será preenchida pela API)
let prayerSchedule = [];

// --- Ícones para as notificações ---
const toastIcons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
};

// --- Toast Notification Function ---
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container not found! Make sure to call setupToastContainer().');
        alert(message); // Fallback
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    // Adiciona o ícone
    const iconContainer = document.createElement('div');
    iconContainer.className = 'toast-icon';
    iconContainer.innerHTML = toastIcons[type] || toastIcons.info;
    toast.appendChild(iconContainer);

    const messageElement = document.createElement('p');
    messageElement.textContent = message;

    toast.appendChild(messageElement);
    
    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Fechar notificação');
    toast.appendChild(closeButton);

    container.appendChild(toast);

    requestAnimationFrame(() => {
        setTimeout(() => toast.classList.add('show'), 10);
    });

    const timeoutId = setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);

    closeButton.addEventListener('click', () => {
        clearTimeout(timeoutId);
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    });
}

// --- Helper to create the container on load ---
function setupToastContainer() {
    if (document.getElementById('toast-container')) return;
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
}

// --- Editor.js Data Renderer ---
function renderEditorJSData(editorData) {
    if (!editorData || !Array.isArray(editorData.blocks) || editorData.blocks.length === 0) {
        return '';
    }

    let html = '';
    editorData.blocks.forEach(block => {
        switch (block.type) {
            case 'header':
                html += `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
                break;
            case 'paragraph':
                html += `<p>${block.data.text}</p>`;
                break;
            case 'list':
                const listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
                html += `<${listTag}>`;
                block.data.items.forEach(item => {
                    html += `<li>${item}</li>`;
                });
                html += `</${listTag}>`;
                break;
            case 'image': // Corresponds to SimpleImage plugin
                html += `<figure class="editor-js-image"><img src="${block.data.url}" alt="${block.data.caption || ''}"><figcaption>${block.data.caption || ''}</figcaption></figure>`;
                break;
            // Add other block types here as needed
            default:
                console.log('Unknown block type:', block.type);
                break;
        }
    });
    return html;
}

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
            const pixCard = Array.from(document.querySelectorAll('.contribution-card')).find(card => card.querySelector('.pix-key'));
            if (pixCard) {
                if (settings.cfg_pix_ativo) {
                    pixCard.classList.remove('contribution-card--disabled');
                } else {
                    pixCard.classList.add('contribution-card--disabled');
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

    // Fecha o menu hamburguer ao rolar a página
    window.addEventListener('scroll', () => {
        if (body.classList.contains('nav-open')) {
            toggleMenu();
        }
    }, { passive: true }); // Melhora a performance do scroll
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
        
        let descriptionHtml = '';
        if (longDesc) {
            try {
                const editorData = JSON.parse(longDesc);
                descriptionHtml = renderEditorJSData(editorData);
            } catch (e) {
                descriptionHtml = longDesc; // Fallback for old HTML or plain text
            }
        }
        modalDescription.innerHTML = descriptionHtml;

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
            modalButton.href = 'index.html#contribua'; // Points to the contribution section
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

    const clockCenter = document.getElementById('clock-center');
    const clockDefaultView = document.getElementById('clock-default-view');
    const clockSlotPicker = document.getElementById('clock-slot-picker');
    let selectedHourForPicker = null;
    let openModalVoluntariarComHorario = null;

    const centerDisplay = document.getElementById('current-prayer');
    const clockTime = document.getElementById('clock');
    const clockHand = document.getElementById('clock-hand');
    const nameListContainer = document.getElementById('prayer-name-list');
    const motivesListContainer = document.getElementById('prayer-motivos-list') || document.querySelector('.prayer-requests-section ul');
    const motivosSubtitle = document.getElementById('motivos-subtitle');
    const btnResetMotivos = document.getElementById('btn-reset-motivos-view');

    // Helper para normalizar horários (HH:MM:00)
    const normalizeTime = (input) => {
        if (!input || input === 'todos' || input === 'geral') return null;
        const str = String(input).trim();
        if (!str) return null;
        const parts = str.split(':');
        const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
        const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
        return `${h}:${m}:00`;
    };

    // Gera os 96 ciclos de 15 minutos do dia (00:00 - 00:15 até 23:45 - 00:00)
    const slots96 = [];
    for (let i = 0; i < 96; i++) {
        const hour = Math.floor(i / 4);
        const minStart = (i % 4) * 15;
        const minEnd = (minStart + 15) % 60;
        const hourEnd = (minStart + 15 === 60) ? (hour + 1) % 24 : hour;

        const startHH = String(hour).padStart(2, '0');
        const startMM = String(minStart).padStart(2, '0');
        const endHH = String(hourEnd).padStart(2, '0');
        const endMM = String(minEnd).padStart(2, '0');

        slots96.push({
            index: i,
            hour: hour,
            minute: minStart,
            timeKey: `${startHH}:${startMM}:00`,
            shortTime: `${startHH}:${startMM}`,
            intervalLabel: `${startHH}:${startMM} - ${endHH}:${endMM}`,
            name: "Disponível",
            isAvailable: true,
            isPending: false,
            motives: []
        });
    }

    let generalMotivos = [];
    let selectedSlotIndex = null;
    let currentActiveName = "Disponível";
    let lastUpdated15MinIndex = -1;
    let relogioAindaNaoIniciou = false;
    let dataFormatadaRelogio = '';

    // --- Busca dados da API ---
    try {
        const response = await fetch('/api/relogio');
        if (response.ok) {
            const data = await response.json();

            const relogioNomePrincipal = document.getElementById('relogio-nome-principal');
            const relogioDataPrincipal = document.getElementById('relogio-data-principal');

            // Caso não haja relógio ativo no momento (expirado após 2h da finalização)
            if (!data || !data.relogio) {
                const btnVoluntariar = document.getElementById('btn-open-voluntariar');
                if (btnVoluntariar) btnVoluntariar.style.display = 'none';

                if (relogioNomePrincipal) relogioNomePrincipal.textContent = 'Relógio de Oração';
                if (relogioDataPrincipal) relogioDataPrincipal.textContent = 'Nenhuma edição ativa no momento';

                const motivosTitle = document.getElementById('motivos-title');
                if (motivosTitle) motivosTitle.textContent = 'Motivos de Oração';
                if (motivosSubtitle) motivosSubtitle.textContent = 'Nenhuma edição ativa no momento';

                if (motivesListContainer) {
                    motivesListContainer.innerHTML = '<li style="text-align: center; color: #666; padding: 25px; line-height: 1.6;">Não há um Relógio de Oração ativo no momento. As escalas e motivos ficam disponíveis até 2 horas após a conclusão de cada edição. Fique atento às nossas notícias para as próximas datas!</li>';
                }
                if (nameListContainer) {
                    nameListContainer.innerHTML = '<li style="justify-content: center; color: #888; font-style: italic; padding: 30px;">Aguardando próximo relógio de oração...</li>';
                }
                if (centerDisplay) {
                    centerDisplay.textContent = 'Sem relógio ativo';
                }
                return;
            }

            // Exibe o Nome do Relógio no Topo e a Data
            if (relogioNomePrincipal && data.relogio.rel_titulo) {
                relogioNomePrincipal.textContent = data.relogio.rel_titulo;
            }
            if (relogioDataPrincipal && data.relogio.rel_data_relogio) {
                const dateObj = new Date(data.relogio.rel_data_relogio);
                const localDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
                const dateFormatted = localDate.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
                dataFormatadaRelogio = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
                relogioDataPrincipal.textContent = dataFormatadaRelogio;
            }

            // Identifica se o relógio pertence a uma data futura
            relogioAindaNaoIniciou = Boolean(data.relogio.ainda_nao_iniciou);
            if (data.relogio.rel_data_relogio) {
                const now = new Date();
                const [ano, mes, dia] = String(data.relogio.rel_data_relogio).split('T')[0].split('-').map(Number);
                const relogioDateMidnight = new Date(ano, mes - 1, dia, 0, 0, 0);
                if (now < relogioDateMidnight) {
                    relogioAindaNaoIniciou = true;
                }
            }

            // Se o relógio já foi finalizado mas ainda está dentro da janela de 2h para consulta
            if (data.relogio.esta_finalizado) {
                const btnVoluntariar = document.getElementById('btn-open-voluntariar');
                if (btnVoluntariar) btnVoluntariar.style.display = 'none';
                if (motivosSubtitle) {
                    motivosSubtitle.innerHTML = `<span style="color:#d35400; font-weight:600;">Concluído (disponível para consulta até as 02h)</span>`;
                }
            } else if (relogioAindaNaoIniciou) {
                if (motivosSubtitle) {
                    motivosSubtitle.innerHTML = `<strong>Início em:</strong> ${dataFormatadaRelogio} (Motivos liberados no dia)`;
                }
            } else if (motivosSubtitle) {
                motivosSubtitle.textContent = 'Turno atual';
            }

            // 1. Mapear Voluntários para seus respectivos ciclos de 15 minutos
            if (Array.isArray(data.voluntarios)) {
                data.voluntarios.forEach(vol => {
                    const normTime = normalizeTime(vol.vol_horario_escolhido);
                    if (normTime) {
                        const targetSlot = slots96.find(s => s.timeKey === normTime);
                        if (targetSlot) {
                            targetSlot.name = vol.vol_nome_completo;
                            targetSlot.isAvailable = false;
                            targetSlot.isPending = false;
                        }
                    }
                });
            }

            // 2. Mapear Solicitações Pendentes para "Em análise"
            if (Array.isArray(data.pendentes)) {
                data.pendentes.forEach(item => {
                    const normTime = normalizeTime(item.sol_horario_escolhido);
                    if (normTime) {
                        const targetSlot = slots96.find(s => s.timeKey === normTime);
                        // Apenas define como "Em análise" se ainda não tiver voluntário confirmado
                        if (targetSlot && targetSlot.isAvailable) {
                            targetSlot.name = "Em análise";
                            targetSlot.isAvailable = false;
                            targetSlot.isPending = true;
                        }
                    }
                });
            }

            // 2. Mapear Motivos de Oração (por ciclo ou gerais)
            if (Array.isArray(data.motivos)) {
                data.motivos.forEach(m => {
                    const normTime = normalizeTime(m.mot_horario);
                    if (normTime) {
                        const targetSlot = slots96.find(s => s.timeKey === normTime);
                        if (targetSlot) {
                            targetSlot.motives.push(m);
                        } else {
                            generalMotivos.push(m);
                        }
                    } else {
                        generalMotivos.push(m);
                    }
                });
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados do relógio de oração:", error);
    }

    // --- 1. SELETOR DE CICLOS DE 15 MIN NO CENTRO DO RELÓGIO ---
    function closeHourPicker() {
        selectedHourForPicker = null;
        if (clockFace) {
            clockFace.querySelectorAll('.clock-slot').forEach(el => el.classList.remove('is-selected-hour'));
        }
        if (clockCenter) {
            clockCenter.classList.remove('is-picking');
        }
        if (clockSlotPicker) {
            clockSlotPicker.style.display = 'none';
            clockSlotPicker.innerHTML = '';
        }
        if (clockDefaultView) {
            clockDefaultView.style.display = 'block';
        }
        updateDisplayToCurrent();
    }

    function renderHourPicker(hour) {
        if (!clockSlotPicker || !clockCenter) return;

        selectedHourForPicker = hour;
        if (clockDefaultView) {
            clockDefaultView.style.display = 'none';
        }
        clockCenter.classList.add('is-picking');
        clockSlotPicker.style.display = 'block';

        const hourFormatted = String(hour).padStart(2, '0');
        const hourSlots = slots96.slice(hour * 4, hour * 4 + 4);

        clockSlotPicker.innerHTML = `
            <div class="clock-picker-container">
                <div class="clock-picker-header">
                    <span class="clock-picker-title">⏰ Ciclos das <strong>${hourFormatted}h</strong></span>
                    <button type="button" class="clock-picker-close" id="btn-close-clock-picker" title="Fechar">&times;</button>
                </div>
                <div class="clock-picker-slots">
                    ${hourSlots.map(slot => {
                        let statusClass = 'is-available';
                        let statusText = 'Disponível';
                        let isClickable = true;

                        if (slot.isPending) {
                            statusClass = 'is-pending';
                            statusText = 'Em análise';
                            isClickable = false;
                        } else if (!slot.isAvailable) {
                            statusClass = 'is-occupied';
                            const firstName = (slot.name || 'Ocupado').split(' ')[0];
                            statusText = firstName;
                            isClickable = false;
                        }

                        if (isClickable) {
                            return `
                                <button type="button" class="clock-slot-picker-btn ${statusClass}" data-short-time="${slot.shortTime}" title="Clique para se voluntariar das ${slot.intervalLabel}">
                                    <span>${slot.intervalLabel}</span>
                                    <span class="slot-status-text">${statusText}</span>
                                </button>
                            `;
                        } else {
                            return `
                                <div class="clock-slot-picker-btn ${statusClass}" title="${slot.isPending ? 'Solicitação em análise' : slot.name}">
                                    <span>${slot.intervalLabel}</span>
                                    <span class="slot-status-text">${statusText}</span>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        `;

        const closeBtn = document.getElementById('btn-close-clock-picker');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeHourPicker();
            });
        }

        // Ao clicar em um horário disponível, abre o formulário com o horário pré-selecionado
        clockSlotPicker.querySelectorAll('button.clock-slot-picker-btn.is-available').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chosenTime = btn.dataset.shortTime;
                if (typeof openModalVoluntariarComHorario === 'function') {
                    openModalVoluntariarComHorario(chosenTime);
                }
            });
        });
    }

    // --- 1. RENDERIZA O RELÓGIO VISUAL (MANTÉM 24 HORAS COMO HOJE) ---
    function renderClockFaceSlots() {
        if (!clockFace) return;
        clockFace.querySelectorAll('.clock-slot').forEach(el => el.remove());

        const radius = (clockFace.offsetWidth || 500) / 2 * 0.8;

        for (let h = 0; h < 24; h++) {
            const angle = (h / 24) * 2 * Math.PI - (Math.PI / 2);
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);

            const slotEl = document.createElement('div');
            slotEl.className = 'clock-slot';
            if (selectedHourForPicker === h) {
                slotEl.classList.add('is-selected-hour');
            }
            slotEl.textContent = String(h).padStart(2, '0');
            slotEl.dataset.hour = h;

            const transformValue = `translate(${x}px, ${y}px)`;
            slotEl.style.transform = transformValue;
            slotEl.style.setProperty('--transform-base', transformValue);

            // Hover no número da hora (00-23): mostra resumo dos voluntários daquela hora
            slotEl.addEventListener('mouseenter', () => {
                if (selectedHourForPicker !== null) return;
                if (!centerDisplay) return;
                const hourSlots = slots96.slice(h * 4, h * 4 + 4);
                const activeVolunteers = hourSlots.filter(s => !s.isAvailable);

                if (activeVolunteers.length === 0) {
                    centerDisplay.textContent = `${String(h).padStart(2, '0')}h: Disponível`;
                } else {
                    const uniqueNames = [...new Set(activeVolunteers.map(v => v.name))];
                    if (uniqueNames.length === 1 && activeVolunteers.length === 4) {
                        centerDisplay.textContent = `${String(h).padStart(2, '0')}h: ${uniqueNames[0]}`;
                    } else {
                        centerDisplay.textContent = `${String(h).padStart(2, '0')}h: ${activeVolunteers.map(v => `${v.shortTime} ${v.name}`).join(' | ')}`;
                    }
                }
            });

            // Clique na hora (00-23): abre o centro do relógio com os 4 ciclos de 15 minutos
            slotEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (selectedHourForPicker === h) {
                    closeHourPicker();
                } else {
                    clockFace.querySelectorAll('.clock-slot').forEach(el => el.classList.remove('is-selected-hour'));
                    slotEl.classList.add('is-selected-hour');
                    renderHourPicker(h);
                }
            });

            clockFace.appendChild(slotEl);
        }
    }

    renderClockFaceSlots();

    const updateDisplayToCurrent = () => {
        if (selectedHourForPicker !== null) return;
        if (!centerDisplay) return;
        centerDisplay.textContent = `Turno de: ${currentActiveName}`;
    };

    clockFace.addEventListener('mouseleave', updateDisplayToCurrent);

    document.addEventListener('click', (e) => {
        if (selectedHourForPicker !== null && clockFace && !clockFace.contains(e.target)) {
            closeHourPicker();
        }
    });

    let clockResizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(clockResizeTimer);
        clockResizeTimer = setTimeout(() => {
            renderClockFaceSlots();
            const now = new Date();
            const currentHour = now.getHours();
            clockFace.querySelectorAll('.clock-slot').forEach(slotEl => {
                const slotHour = parseInt(slotEl.dataset.hour, 10);
                slotEl.classList.remove('active', 'past');
                if (slotHour < currentHour) slotEl.classList.add('past');
                else if (slotHour === currentHour) slotEl.classList.add('active');
            });
        }, 150);
    });

    // --- 2. RENDERIZA A ESCALA DE ORAÇÃO (TABELA/LISTA COM OS 96 INTERVALOS DE 15 MINUTOS) ---
    if (nameListContainer) {
        nameListContainer.innerHTML = '';
        slots96.forEach(slot => {
            const li = document.createElement('li');
            li.dataset.index = slot.index;
            li.dataset.time = slot.timeKey;

            const hourSpan = document.createElement('span');
            hourSpan.className = 'hour';
            hourSpan.textContent = slot.intervalLabel;

            const nameSpan = document.createElement('span');
            let nameClass = 'name';
            if (slot.isPending) {
                nameClass += ' is-pending';
            } else if (slot.isAvailable) {
                nameClass += ' is-available';
            }
            nameSpan.className = nameClass;
            nameSpan.textContent = slot.name;

            li.appendChild(hourSpan);
            li.appendChild(nameSpan);

            if (slot.motives.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'badge-motive-pill';
                badge.title = `${slot.motives.length} motivo(s) específico(s) para este ciclo`;
                badge.textContent = `🙏 ${slot.motives.length}`;
                li.appendChild(badge);
            }

            // Ao clicar em um horário na escala, exibe os motivos específicos deste ciclo
            li.addEventListener('click', () => {
                selectSlotForMotives(slot.index);
            });

            nameListContainer.appendChild(li);
        });
    }

    // --- 3. EXIBIÇÃO DINÂMICA DOS MOTIVOS DE ORAÇÃO (TURNO ATUAL E PRÓXIMO TURNO COM VOLUNTÁRIOS) ---
    function renderMotivos(slotIndex, isUserSelection = false) {
        if (!motivesListContainer) return;

        const currentSlot = slots96[slotIndex];
        if (!currentSlot) return;

        const nextSlotIndex = (slotIndex + 1) % 96;
        const nextSlot = slots96[nextSlotIndex];

        // Formata os dados e estado do voluntário do horário
        function getVolunteerData(slot) {
            if (slot.isPending) {
                return {
                    label: 'Em análise',
                    badgeClass: 'is-pending',
                    icon: '⏳'
                };
            }
            if (slot.isAvailable || slot.name === 'Disponível') {
                return {
                    label: 'Horário Disponível',
                    badgeClass: 'is-available',
                    icon: '🙏'
                };
            }
            return {
                label: slot.name,
                badgeClass: 'is-assigned',
                icon: '👤'
            };
        }

        // Formata os motivos do slot
        function getSlotMotivesHtml(slot) {
            if (!slot.motives || slot.motives.length === 0) {
                return '<span style="color:#888; font-style:italic;">Nenhum motivo específico cadastrado para este turno.</span>';
            }
            return slot.motives.map(m => {
                const text = String(m.mot_descricao || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>');
                return `<div style="margin-bottom: 6px;">${text}</div>`;
            }).join('');
        }

        // CENÁRIO A: O relógio ainda NÃO chegou no seu dia oficial (data futura)
        if (relogioAindaNaoIniciou) {
            if (btnResetMotivos) {
                btnResetMotivos.style.display = isUserSelection ? 'inline-block' : 'none';
                btnResetMotivos.textContent = 'Ver Início do Relógio';
            }

            motivesListContainer.innerHTML = '';

            if (isUserSelection) {
                if (motivosSubtitle) {
                    motivosSubtitle.innerHTML = `<strong>Turno Selecionado na Escala:</strong> ${currentSlot.intervalLabel} &bull; <strong>Início:</strong> ${dataFormatadaRelogio || 'Em breve'}`;
                }
                const volData = getVolunteerData(currentSlot);
                const card = document.createElement('li');
                card.className = 'motive-turn-card current-turn-card';
                card.style.gridColumn = '1 / -1';
                card.style.maxWidth = '680px';
                card.style.margin = '0 auto';
                card.innerHTML = `
                    <div class="motive-card-header">
                        <div class="motive-status-pill selected">
                            <span>🎯</span>
                            <strong>HORÁRIO SELECIONADO NA ESCALA</strong>
                        </div>
                        <span class="motive-time-badge">${currentSlot.intervalLabel}</span>
                    </div>
                    <div class="motive-volunteer-info">
                        <span>${volData.icon}</span>
                        <span style="font-weight:600;">Voluntário:</span>
                        <span class="volunteer-name-badge ${volData.badgeClass}">${volData.label}</span>
                    </div>
                    <div class="motive-content-body">
                        <div class="motive-section-label">Motivos de Oração:</div>
                        <div class="motive-text-content" style="color: #666; font-style: italic; background: #fdfefe; border: 1.5px dashed #bdc3c7; padding: 14px; border-radius: 8px;">
                            🔒 Os motivos de oração deste ciclo serão liberados e atualizados automaticamente no dia do relógio (${dataFormatadaRelogio || 'data do evento'}).
                        </div>
                    </div>
                `;
                motivesListContainer.appendChild(card);
                return;
            }

            // Exibição padrão antes da data do relógio: Card de aviso / contagem regressiva
            if (motivosSubtitle) {
                motivosSubtitle.innerHTML = `<strong>Relógio em Preparação:</strong> Início em ${dataFormatadaRelogio || 'breve'}`;
            }

            const avisoCard = document.createElement('li');
            avisoCard.className = 'motive-turn-card';
            avisoCard.style.gridColumn = '1 / -1';
            avisoCard.style.background = '#ffffff';
            avisoCard.style.border = '1.5px dashed var(--secondary-color, #3498db)';
            avisoCard.style.borderLeft = '6px solid var(--secondary-color, #3498db)';
            avisoCard.style.padding = '28px 22px';
            avisoCard.style.textAlign = 'center';
            avisoCard.style.maxWidth = '780px';
            avisoCard.style.margin = '0 auto';
            avisoCard.innerHTML = `
                <div style="font-size: 2.3rem; margin-bottom: 12px;">⏰ 🙏</div>
                <h4 style="margin: 0 0 10px 0; color: var(--text-dark, #2c3e50); font-size: 1.3rem; font-weight: 700;">
                    Este Relógio de Oração Começa em Breve!
                </h4>
                <p style="margin: 0 0 16px 0; color: #555; font-size: 1rem; line-height: 1.6; max-width: 640px; margin-inline: auto;">
                    A data oficial desta edição é <strong>${dataFormatadaRelogio || 'em breve'}</strong>.<br>
                    Os motivos de oração do <strong>Turno Atual</strong> e do <strong>Próximo Turno</strong> começarão a aparecer automaticamente em tempo real a partir das <strong>00:00 do dia do relógio</strong>.
                </p>
                <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(52, 152, 219, 0.1); color: #2980b9; padding: 10px 22px; border-radius: 30px; font-size: 0.94rem; font-weight: 600;">
                    <span>✨</span> A escala já está aberta! Escolha seu horário de 15 minutos abaixo e se voluntarie.
                </div>
            `;
            motivesListContainer.appendChild(avisoCard);
            return;
        }

        // CENÁRIO B: O relógio está em andamento (já é o dia do relógio)
        if (motivosSubtitle) {
            if (isUserSelection) {
                motivosSubtitle.innerHTML = `<strong>Turno Selecionado:</strong> ${currentSlot.intervalLabel} &bull; <strong>A Seguir:</strong> ${nextSlot.intervalLabel}`;
            } else {
                motivosSubtitle.innerHTML = `<strong>Turno Atual:</strong> ${currentSlot.intervalLabel} &bull; <strong>A Seguir:</strong> ${nextSlot.intervalLabel}`;
            }
        }

        if (btnResetMotivos) {
            btnResetMotivos.style.display = isUserSelection ? 'inline-block' : 'none';
            btnResetMotivos.textContent = 'Ver Turno Atual';
        }

        motivesListContainer.innerHTML = '';

        const currentVol = getVolunteerData(currentSlot);
        const nextVol = getVolunteerData(nextSlot);

        // --- Card 1: Turno Atual (ou Selecionado) ---
        const currentCard = document.createElement('li');
        currentCard.className = 'motive-turn-card current-turn-card';
        currentCard.innerHTML = `
            <div class="motive-card-header">
                <div class="motive-status-pill ${isUserSelection ? 'selected' : 'current'}">
                    ${isUserSelection ? '<span>🎯</span>' : '<span class="motive-live-dot"></span>'}
                    <strong>${isUserSelection ? 'TURNO SELECIONADO' : 'TURNO ATUAL'}</strong>
                </div>
                <span class="motive-time-badge">${currentSlot.intervalLabel}</span>
            </div>
            <div class="motive-volunteer-info">
                <span>${currentVol.icon}</span>
                <span style="font-weight:600;">Voluntário:</span>
                <span class="volunteer-name-badge ${currentVol.badgeClass}">${currentVol.label}</span>
            </div>
            <div class="motive-content-body">
                <div class="motive-section-label">Motivo de Oração:</div>
                <div class="motive-text-content">${getSlotMotivesHtml(currentSlot)}</div>
            </div>
        `;
        motivesListContainer.appendChild(currentCard);

        // --- Card 2: Próximo Turno ---
        const nextCard = document.createElement('li');
        nextCard.className = 'motive-turn-card next-turn-card';
        nextCard.innerHTML = `
            <div class="motive-card-header">
                <div class="motive-status-pill next">
                    <span>⏳</span>
                    <strong>A SEGUIR (PRÓXIMO TURNO)</strong>
                </div>
                <span class="motive-time-badge">${nextSlot.intervalLabel}</span>
            </div>
            <div class="motive-volunteer-info">
                <span>${nextVol.icon}</span>
                <span style="font-weight:600;">Voluntário:</span>
                <span class="volunteer-name-badge ${nextVol.badgeClass}">${nextVol.label}</span>
            </div>
            <div class="motive-content-body">
                <div class="motive-section-label">Motivo de Oração:</div>
                <div class="motive-text-content">${getSlotMotivesHtml(nextSlot)}</div>
            </div>
        `;
        motivesListContainer.appendChild(nextCard);

        // --- Card 3: Motivos Gerais (se houver) ---
        if (generalMotivos && generalMotivos.length > 0) {
            const generalCard = document.createElement('li');
            generalCard.className = 'motive-turn-card';
            generalCard.style.gridColumn = '1 / -1';
            generalCard.style.borderLeft = '6px solid #8e44ad !important';
            generalCard.innerHTML = `
                <div class="motive-card-header">
                    <div class="motive-status-pill" style="background:#f4ecf7; color:#8e44ad; border:1px solid rgba(142,68,173,0.2);">
                        <span>✨</span>
                        <strong>MOTIVOS GERAIS DE ORAÇÃO</strong>
                    </div>
                    <span class="motive-time-badge" style="background:#f4ecf7; color:#8e44ad;">Todos os turnos</span>
                </div>
                <div class="motive-content-body">
                    ${generalMotivos.map(m => {
                        const text = String(m.mot_descricao || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                        return `<div style="margin-bottom:8px; line-height:1.5;">• ${text}</div>`;
                    }).join('')}
                </div>
            `;
            motivesListContainer.appendChild(generalCard);
        }
    }

    function selectSlotForMotives(index) {
        selectedSlotIndex = index;
        if (nameListContainer) {
            nameListContainer.querySelectorAll('li').forEach(el => el.classList.remove('is-selected'));
            const targetLi = nameListContainer.querySelector(`li[data-index="${index}"]`);
            if (targetLi) {
                targetLi.classList.add('is-selected');
                targetLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
        renderMotivos(index, true);
    }

    if (btnResetMotivos) {
        btnResetMotivos.addEventListener('click', () => {
            selectedSlotIndex = null;
            if (nameListContainer) {
                nameListContainer.querySelectorAll('li').forEach(el => el.classList.remove('is-selected'));
            }
            const now = new Date();
            const currentSlotIndex = now.getHours() * 4 + Math.floor(now.getMinutes() / 15);
            renderMotivos(currentSlotIndex, false);
            if (!relogioAindaNaoIniciou) {
                const activeLi = nameListContainer ? nameListContainer.querySelector(`li[data-index="${currentSlotIndex}"]`) : null;
                if (activeLi) {
                    activeLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        });
    }

    // --- 4. ATUALIZAÇÃO DO RELÓGIO A CADA SEGUNDO ---
    function updateClockState() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const hours = String(currentHour).padStart(2, '0');
        const minutes = String(currentMinute).padStart(2, '0');

        if (clockTime) clockTime.textContent = `${hours}:${minutes}`;

        // Ponteiro gira 360 graus em 24 horas (15 graus/hora + 0.25 graus/minuto)
        const rotationDegrees = (currentHour * 15) + (currentMinute * 0.25);
        if (clockHand) clockHand.style.transform = `rotate(${rotationDegrees}deg)`;

        // Índice do ciclo atual de 15 minutos (0 a 95)
        const currentSlotIndex = currentHour * 4 + Math.floor(currentMinute / 15);
        const currentSlot = slots96[currentSlotIndex];
        currentActiveName = currentSlot ? currentSlot.name : "Disponível";

        // Se o ciclo de 15 minutos mudou (ou na primeira execução)
        if (currentSlotIndex !== lastUpdated15MinIndex) {
            updateDisplayToCurrent();

            // Atualiza horas ativas/passadas no relógio circular de 24h
            clockFace.querySelectorAll('.clock-slot').forEach(slotEl => {
                const slotHour = parseInt(slotEl.dataset.hour, 10);
                slotEl.classList.remove('active', 'past');
                if (slotHour < currentHour) slotEl.classList.add('past');
                else if (slotHour === currentHour) slotEl.classList.add('active');
            });

            // Atualiza o item ativo na escala de 15 minutos
            if (nameListContainer) {
                const prevActive = nameListContainer.querySelector('li.active');
                if (prevActive) prevActive.classList.remove('active');

                const newActiveLi = nameListContainer.querySelector(`li[data-index="${currentSlotIndex}"]`);
                if (newActiveLi) {
                    newActiveLi.classList.add('active');
                    // Rola suavemente até o item atual na primeira carga
                    if (lastUpdated15MinIndex === -1 && selectedSlotIndex === null) {
                        newActiveLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }
                }
            }

            // Se o usuário não clicou para inspecionar um horário específico, atualiza os motivos para o turno atual
            if (selectedSlotIndex === null) {
                renderMotivos(currentSlotIndex, false);
            }

            lastUpdated15MinIndex = currentSlotIndex;
        }
    }

    updateClockState();
    updateDisplayToCurrent();
    setInterval(updateClockState, 1000);

    // --- 5. MODAL SE VOLUNTARIAR ---
    const btnOpenVoluntariar = document.getElementById('btn-open-voluntariar');
    const modalVoluntariar = document.getElementById('modal-voluntariar');
    const btnCloseVoluntariar = document.getElementById('btn-close-voluntariar');
    const btnCancelVoluntariar = document.getElementById('btn-cancel-voluntariar');
    const formVoluntariar = document.getElementById('form-voluntariar');
    const inputNomeCompleto = document.getElementById('vol-nome-completo');
    const selectHorario = document.getElementById('vol-horario-select');
    const statusVoluntariar = document.getElementById('vol-form-status');
    const errorNome = document.getElementById('vol-nome-error');
    const btnSubmitVoluntariar = document.getElementById('btn-submit-voluntariar');

    if (btnOpenVoluntariar && modalVoluntariar) {
        // Preenche o select com os 96 ciclos de 15 minutos
        function populateHorariosSelect() {
            if (!selectHorario) return;
            selectHorario.innerHTML = '<option value="">-- Selecione o ciclo de 15 minutos --</option>';
            slots96.forEach(slot => {
                const opt = document.createElement('option');
                opt.value = slot.shortTime;
                if (slot.isPending) {
                    opt.textContent = `${slot.intervalLabel} (Em análise - Indisponível)`;
                    opt.disabled = true;
                    opt.style.color = '#b9770e';
                } else if (!slot.isAvailable) {
                    opt.textContent = `${slot.intervalLabel} (Ocupado - Indisponível)`;
                    opt.disabled = true;
                    opt.style.color = '#999';
                } else {
                    opt.textContent = `${slot.intervalLabel} (Disponível)`;
                }
                selectHorario.appendChild(opt);
            });
        }

        const openModal = (targetShortTime = null) => {
            populateHorariosSelect();
            if (formVoluntariar) formVoluntariar.reset();
            if (targetShortTime && selectHorario) {
                selectHorario.value = targetShortTime;
            }
            if (statusVoluntariar) {
                statusVoluntariar.style.display = 'none';
                statusVoluntariar.textContent = '';
            }
            if (errorNome) errorNome.style.display = 'none';
            modalVoluntariar.classList.add('is-visible');
            document.body.classList.add('modal-open');
            if (inputNomeCompleto) {
                setTimeout(() => inputNomeCompleto.focus(), 150);
            }
        };

        openModalVoluntariarComHorario = openModal;

        const closeModal = () => {
            modalVoluntariar.classList.remove('is-visible');
            document.body.classList.remove('modal-open');
        };

        btnOpenVoluntariar.addEventListener('click', () => openModal());
        if (btnCloseVoluntariar) btnCloseVoluntariar.addEventListener('click', closeModal);
        if (btnCancelVoluntariar) btnCancelVoluntariar.addEventListener('click', closeModal);

        // Fecha clicando no overlay
        modalVoluntariar.addEventListener('click', (e) => {
            if (e.target === modalVoluntariar) closeModal();
        });

        // Validação e Envio do Formulário
        if (formVoluntariar) {
            formVoluntariar.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nomeCompleto = (inputNomeCompleto.value || '').trim();
                const horarioEscolhido = selectHorario.value;

                // Valida Nome e Sobrenome (mínimo de 2 palavras, cada uma com pelo menos 2 caracteres)
                const parts = nomeCompleto.split(/\s+/).filter(p => p.length > 0);
                if (parts.length < 2 || parts.some(p => p.length < 2)) {
                    if (errorNome) errorNome.style.display = 'block';
                    inputNomeCompleto.focus();
                    return;
                } else {
                    if (errorNome) errorNome.style.display = 'none';
                }

                if (!horarioEscolhido) {
                    alert('Por favor, selecione um horário para interceder.');
                    selectHorario.focus();
                    return;
                }

                // Valida se o horário escolhido não está ocupado ou em análise
                const chosenSlot = slots96.find(s => s.shortTime === horarioEscolhido);
                if (chosenSlot && (!chosenSlot.isAvailable || chosenSlot.isPending)) {
                    if (statusVoluntariar) {
                        statusVoluntariar.style.display = 'block';
                        statusVoluntariar.style.backgroundColor = '#f8d7da';
                        statusVoluntariar.style.color = '#721c24';
                        statusVoluntariar.style.border = '1px solid #f5c6cb';
                        statusVoluntariar.textContent = chosenSlot.isPending
                            ? 'Este horário já possui uma solicitação em análise. Por favor, selecione outro horário.'
                            : 'Este horário já está ocupado por outro voluntário. Por favor, selecione outro horário.';
                    }
                    return;
                }

                // Envio para o backend
                try {
                    btnSubmitVoluntariar.disabled = true;
                    btnSubmitVoluntariar.textContent = 'Enviando...';
                    if (statusVoluntariar) {
                        statusVoluntariar.style.display = 'none';
                    }

                    const response = await fetch('/api/relogio/solicitacao', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            vol_nome_completo: nomeCompleto,
                            vol_horario_escolhido: horarioEscolhido
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Erro ao enviar solicitação.');
                    }

                    if (statusVoluntariar) {
                        statusVoluntariar.style.display = 'block';
                        statusVoluntariar.style.backgroundColor = '#d4edda';
                        statusVoluntariar.style.color = '#155724';
                        statusVoluntariar.style.border = '1px solid #c3e6cb';
                        statusVoluntariar.textContent = data.message || 'Solicitação enviada com sucesso!';
                    }

                    // Atualiza imediatamente o ciclo na tela para "Em análise"
                    const targetSlot = slots96.find(s => s.shortTime === horarioEscolhido);
                    if (targetSlot && targetSlot.isAvailable) {
                        targetSlot.name = "Em análise";
                        targetSlot.isAvailable = false;
                        targetSlot.isPending = true;
                        if (nameListContainer) {
                            const li = nameListContainer.querySelector(`li[data-time="${targetSlot.timeKey}"]`);
                            if (li) {
                                const nameEl = li.querySelector('.name');
                                if (nameEl) {
                                    nameEl.className = 'name is-pending';
                                    nameEl.textContent = 'Em análise';
                                }
                            }
                        }
                        // Se o seletor da hora estiver aberto no centro do relógio, atualiza os botões imediatamente
                        if (selectedHourForPicker !== null) {
                            renderHourPicker(selectedHourForPicker);
                        }
                    }

                    formVoluntariar.reset();

                    setTimeout(() => {
                        closeModal();
                    }, 2200);

                } catch (err) {
                    if (statusVoluntariar) {
                        statusVoluntariar.style.display = 'block';
                        statusVoluntariar.style.backgroundColor = '#f8d7da';
                        statusVoluntariar.style.color = '#721c24';
                        statusVoluntariar.style.border = '1px solid #f5c6cb';
                        statusVoluntariar.textContent = err.message;
                    }
                } finally {
                    btnSubmitVoluntariar.disabled = false;
                    btnSubmitVoluntariar.textContent = 'Enviar Solicitação';
                }
            });
        }
    }
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

                let storyHtml = '';
                if (item.ntc_corpo_mensagem) {
                    try {
                        const editorData = JSON.parse(item.ntc_corpo_mensagem);
                        storyHtml = renderEditorJSData(editorData); // Use the new renderer
                    } catch (e) {
                        storyHtml = item.ntc_corpo_mensagem; // Fallback for old HTML content
                    }
                }
                modalFullStory.innerHTML = storyHtml;

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
                showToast('Não foi possível carregar os detalhes da notícia.', 'error');
            });
    });

    function closeModal() {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    modalCloseBtn.addEventListener('click', closeModal);
}

function setupFloatingButtonsBehavior() {
    const backToTopButton = document.getElementById('back-to-top');
    const whatsappFab = document.querySelector('.whatsapp-fab');
    const notificationFab = document.querySelector('.notification-fab');

    // Não executa se nenhum botão for encontrado
    if (!backToTopButton && !whatsappFab && !notificationFab) return;

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // Lógica para a visibilidade do botão "Voltar ao Topo" baseada na profundidade da rolagem
        if (backToTopButton) {
            if (currentScrollY > 300) {
                backToTopButton.classList.add('show');
            } else {
                backToTopButton.classList.remove('show');
            }
        }

        // Lógica para mostrar/esconder botões baseada na direção da rolagem
        // Um pequeno buffer (5px) é adicionado para evitar que esconda em rolagens mínimas
        if (currentScrollY > lastScrollY + 5 && currentScrollY > 100) {
            // Rolando para baixo
            if (whatsappFab) whatsappFab.classList.add('fab-hidden');
            if (notificationFab) notificationFab.classList.add('fab-hidden');
            if (backToTopButton) backToTopButton.classList.add('fab-hidden');
        } else {
            // Rolando para cima ou no topo da página
            if (whatsappFab) whatsappFab.classList.remove('fab-hidden');
            if (notificationFab) notificationFab.classList.remove('fab-hidden');
            if (backToTopButton) backToTopButton.classList.remove('fab-hidden');
        }

        lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    });

    // Mantém o listener de clique para o botão "Voltar ao Topo"
    if (backToTopButton) {
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
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
                    showToast(`Erro ao enviar: ${errorMessage}`, 'error');
                }).catch(() => {
                    showToast('Ocorreu um erro ao processar a resposta do servidor.', 'error');
                });
            }
        })
        .catch(error => {
            console.error('Fetch Error:', error);
            showToast('Ocorreu um erro de rede. Verifique sua conexão e tente novamente.', 'error');
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

            const copySuccess = () => {
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
            };

            const copyFailure = (err) => {
                console.error('Falha ao copiar a chave PIX:', err);
                showToast('Não foi possível copiar a chave. Por favor, copie manualmente.', 'error');
            };

            // --- Copy logic with fallback for mobile/older browsers ---
            if (navigator.clipboard) {
                navigator.clipboard.writeText(originalText).then(copySuccess).catch(err => {
                    console.warn('navigator.clipboard.writeText() falhou, tentando método legado.', err);
                    fallbackCopy(originalText);
                });
            } else {
                fallbackCopy(originalText);
            }

            function fallbackCopy(text) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                
                // Avoid scrolling to bottom and make it non-visible
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.position = "fixed";
                textArea.style.opacity = 0;
            
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
            
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        copySuccess();
                    } else {
                        copyFailure(new Error('document.execCommand returned false'));
                    }
                } catch (err) {
                    copyFailure(err);
                }
            
                document.body.removeChild(textArea);
            }
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

            // 2. Gerar Preview do Texto
            let textoPuro = '';
            if (noticia.ntc_corpo_mensagem) {
                try {
                    const editorData = JSON.parse(noticia.ntc_corpo_mensagem);
                    // Junta o texto de todos os blocos para criar um preview
                    textoPuro = editorData.blocks.map(block => {
                        if (block.type === 'list') return block.data.items.join(' ');
                        return block.data.text || '';
                    }).join(' ').trim();
                } catch (e) {
                    // Fallback para conteúdo antigo em HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = noticia.ntc_corpo_mensagem;
                    textoPuro = tempDiv.textContent || tempDiv.innerText || '';
                }
            }
            const previewText = textoPuro.length > 150 ? textoPuro.substring(0, 150) + '...' : textoPuro;

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
            card.dataset.imgSrc = missionary.mis_imagem_url;
            card.dataset.longDesc = missionary.mis_historia; // mis_historia

            // Simple logic to get country code for flag // mis_pais
            const countryCode = countryCodeMap[missionary.mis_pais.toLowerCase()] || missionary.mis_pais.toLowerCase().slice(0, 2);

            // Gera a descrição curta a partir do JSON ou HTML
            let shortDescText = '';
            if (missionary.mis_descricao) {
                try {
                    const editorData = JSON.parse(missionary.mis_descricao);
                    shortDescText = editorData.blocks.map(block => {
                        if (block.type === 'list') return block.data.items.join(' ');
                        return block.data.text || '';
                    }).join(' ').trim();
                } catch (e) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = missionary.mis_descricao;
                    shortDescText = tempDiv.textContent || tempDiv.innerText || '';
                }
            }
            // Trunca se necessário
            if (shortDescText.length > 150) shortDescText = shortDescText.substring(0, 147) + '...';

            card.innerHTML = `
                <div class="missionary-flag">
                    <img src="https://flagcdn.com/${countryCode}.svg" alt="Bandeira de ${missionary.mis_pais}">
                </div>
                <div class="missionary-img-wrapper">
                    <img src="${missionary.mis_imagem_url || ''}" alt="Foto de ${missionary.nome}">
                </div>
                <h4>${missionary.nome}</h4>
                <p>${shortDescText}</p>
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

        // Remove o container de cabeçalho anterior, se houver
        const existingHeader = document.querySelector('.titus-header-container');
        if (existingHeader) {
            existingHeader.remove();
        }

        // Remove o título anterior, se houver, para evitar duplicação
        const existingTitle = titusBoard.querySelector('.titus-board-title');
        if (existingTitle) {
            existingTitle.remove();
        }

        // Adiciona o título "QUADRO TITO" dentro do quadro
        const titleElement = document.createElement('h2');
        titleElement.className = 'titus-board-title';
        titleElement.textContent = 'QUADRO TITO';
        titusBoard.insertBefore(titleElement, titusGrid);

        if (!board) {
            titusGrid.innerHTML = '<p style="color: white; grid-column: 1 / -1; text-align: center;">Não há post-its ativos no quadro no momento.</p>';
            return;
        }

        // Cria o container para o cabeçalho do quadro (período e botão)
        const headerContainer = document.createElement('div');
        headerContainer.className = 'titus-header-container';

        const formatDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            // Adjust for timezone to show the correct local date
            return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        headerContainer.innerHTML = `
            <div class="titus-period-display"><strong>Período ativo:</strong> ${formatDate(board.qdt_data_inicial)} a ${formatDate(board.qdt_data_final)}</div>
            <button id="open-suggestion-modal" class="btn btn-primary">Inserir Post-it</button>
        `;
        titusBoard.parentNode.insertBefore(headerContainer, titusBoard);

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
    // Detect current page
    const isIndexPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html');
    const isEventsPage = window.location.pathname.endsWith('eventos.html');

    // Find containers on the current page
    const indexGrid = isIndexPage ? document.querySelector('.events-section .events-grid') : null;
    const indexBtnContainer = isIndexPage ? document.getElementById('all-events-btn-container') : null;
    const eventsPageHighlightContainer = isEventsPage ? document.getElementById('next-event-highlight') : null;
    const eventsPageGrid = isEventsPage ? document.querySelector('.events-grid-full-page') : null;

    // Exit if not on a relevant page
    if (!isIndexPage && !isEventsPage) return;

    try {
        const response = await fetch('/api/eventos');
        if (!response.ok) throw new Error('Failed to fetch events');
        let allEvents = await response.json();

        // Filter for upcoming events
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normaliza para o início do dia
        let upcomingEvents = allEvents.filter(event => {
            const eventEndDate = new Date(event.evt_data_final);
            return eventEndDate >= today;
        });

        // Sort by start date
        upcomingEvents.sort((a, b) => new Date(a.evt_data_inicial) - new Date(b.evt_data_inicial));

        // Helper function to create an event card element
        const createEventCard = (event, isHighlighted = false, isNextOnIndex = false) => {
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
            if (isHighlighted) {
                card.classList.add('event-card--highlighted-full');
            }
            if (isNextOnIndex) {
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
            return card;
        };

        // Logic for index.html
        if (isIndexPage && indexGrid) {
            const eventsToShow = upcomingEvents.slice(0, 5);
            indexGrid.innerHTML = '';

            if (eventsToShow.length === 0) {
                indexGrid.innerHTML = '<p>Nenhum evento programado no momento.</p>';
            } else {
                eventsToShow.forEach((event, index) => {
                    const card = createEventCard(event, false, index === 0);
                    indexGrid.appendChild(card);
                });

                if (upcomingEvents.length > 5 && indexBtnContainer) {
                    indexBtnContainer.innerHTML = `<a href="eventos.html" class="btn btn-dark">Todos os eventos</a>`;
                }
            }
        }

        // Logic for eventos.html
        if (isEventsPage && eventsPageGrid && eventsPageHighlightContainer) {
            eventsPageGrid.innerHTML = '';
            eventsPageHighlightContainer.innerHTML = '';

            if (upcomingEvents.length === 0) {
                eventsPageHighlightContainer.innerHTML = '<p>Nenhum evento programado no momento.</p>';
            } else {
                const nextEvent = upcomingEvents.shift(); // Take the first event for highlighting
                const highlightedCard = createEventCard(nextEvent, true);
                eventsPageHighlightContainer.appendChild(highlightedCard);

                if (upcomingEvents.length > 0) {
                    upcomingEvents.forEach(event => {
                        const card = createEventCard(event);
                        eventsPageGrid.appendChild(card);
                    });
                } else {
                    eventsPageGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Nenhum outro evento futuro programado.</p>';
                }
            }
        }

        // --- FIX for Anchor Link after Dynamic Content Load ---
        // After dynamically loading events, the page height changes. If the user
        // navigated directly to an anchor (e.g., index.html#contribua), the initial
        // scroll position might be wrong. This code re-triggers the scroll to the
        // correct element after the content has been rendered.
        if (isIndexPage && window.location.hash) {
            const targetElement = document.querySelector(window.location.hash);
            if (targetElement) {
                // A small timeout ensures the browser has finished rendering the new content.
                setTimeout(() => targetElement.scrollIntoView(), 100);
            }
        }

    } catch (error) {
        console.error('Error loading public events:', error);
        if (indexGrid) indexGrid.innerHTML = '<p>Não foi possível carregar os eventos no momento.</p>';
        if (eventsPageGrid) eventsPageGrid.innerHTML = '<p>Não foi possível carregar os eventos no momento.</p>';
    }
}

function setupTitusSuggestionModal() {
    const modal = document.getElementById('suggestion-modal');
    if (!modal) return;

    // O botão só existe se houver um quadro ativo, então o listener é adicionado depois
    const openBtn = document.getElementById('open-suggestion-modal');
    if (!openBtn) return; 

    const closeBtn = modal.querySelector('.modal-close');
    const form = document.getElementById('suggestion-form');
    const body = document.body;

    const openModal = () => {
        modal.classList.add('is-visible');
        body.classList.add('modal-open');
    };

    const closeModal = () => {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
        form.reset();
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        const data = {
            nome_autor: form.sug_nome_autor.value,
            conteudo: form.sug_conteudo.value
        };

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
            const response = await fetch('/api/tito/sugestao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro no servidor');
            
            showToast(result.message, 'success');
            closeModal();

        } catch (error) {
            showToast(`Erro ao enviar sugestão: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
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
    const logoContainer = document.querySelector('.logo-container');
    if (!logoContainer) return;

    let pressTimer;

    const startPress = (e) => {
        // Previne comportamento padrão em touch, como scroll
        e.preventDefault();
        pressTimer = window.setTimeout(() => {
            window.location.href = 'admin.html';
        }, 4000); // 4 segundos
    };

    const cancelPress = () => {
        clearTimeout(pressTimer);
    };

    logoContainer.addEventListener('mousedown', startPress);
    logoContainer.addEventListener('mouseup', cancelPress);
    logoContainer.addEventListener('mouseleave', cancelPress);
    logoContainer.addEventListener('touchstart', startPress, { passive: false });
    logoContainer.addEventListener('touchend', cancelPress);
}

function setupPushNotifications() {
    const notificationBtn = document.getElementById('notification-fab');
    if (!notificationBtn) return;

    // --- Helper functions for detection ---
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isSafariOnIOS = isIOS && /Safari/.test(navigator.userAgent) && !/CriOS/.test(navigator.userAgent) && !/FxiOS/.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;

    // --- Feature Detection ---
    // Push Notifications require a secure context (HTTPS) and browser support.
    const isPushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

    if (!isPushSupported) {
        // Specific handling for iOS Safari users who haven't installed the PWA
        if (isSafariOnIOS && !isPWA) {
            notificationBtn.style.display = 'flex'; // Make sure it's visible
            notificationBtn.title = 'Adicione à Tela de Início para ativar notificações';
            // Change icon to an info icon
            notificationBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
            
            notificationBtn.addEventListener('click', () => {
                const iosModal = document.getElementById('ios-instructions-modal');
                if (iosModal) {
                    iosModal.classList.add('is-visible');
                    document.body.classList.add('modal-open');
                }
            });

            // Add listeners for the new modal's close buttons
            const iosModal = document.getElementById('ios-instructions-modal');
            if (iosModal) {
                const closeModal = () => {
                    iosModal.classList.remove('is-visible');
                    document.body.classList.remove('modal-open');
                };
                iosModal.querySelector('.modal-close').addEventListener('click', closeModal);
                const closeBtn = iosModal.querySelector('#ios-instructions-close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', closeModal);
                }
            }

        } else {
            // For all other unsupported browsers (like Chrome on iOS), hide the button.
            console.warn('As notificações push não são suportadas por este navegador ou neste contexto (requer HTTPS). No iOS, apenas são suportadas em apps adicionados à Tela de Início via Safari.');
            notificationBtn.style.display = 'none';
        }
        return;
    }

    // Helper function to convert VAPID key
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async function subscribeUserToPush() {
        try {
            const response = await fetch('/api/vapid-public-key');
            const vapidPublicKey = await response.text();
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

            const serviceWorkerRegistration = await navigator.serviceWorker.ready;
            const subscription = await serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // Envia a inscrição para o backend
            await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            showToast('Inscrição para notificações realizada com sucesso!', 'success');
            notificationBtn.style.display = 'none'; // Esconde o botão após a inscrição

        } catch (error) {
            console.error('Falha ao se inscrever para notificações push:', error);
            showToast('Não foi possível ativar as notificações. Por favor, tente novamente.', 'error');
        }
    }

    notificationBtn.addEventListener('click', () => {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                subscribeUserToPush();
            } else {
                showToast('Você precisa permitir as notificações para receber alertas.', 'info');
            }
        });
    });

    // Esconde o botão se o usuário já tiver permitido notificações
    if (('Notification' in window) && Notification.permission === 'granted') {
        notificationBtn.style.display = 'none';
    }
}

function setupServiceWorker() {
    // Verifica se o navegador suporta Service Workers para PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('PWA Service Worker registrado com sucesso, escopo:', registration.scope);
                })
                .catch(error => {
                    console.log('Falha ao registrar PWA Service Worker:', error);
                });
        });
    }
}

// --- Inicialização de todas as funções ---
(async () => {
    const inMaintenance = await applyGlobalSettings();
    if (inMaintenance) return; // Para a execução do script se a página estiver em manutenção

    setupToastContainer(); // Adiciona o container para as notificações
    updateFooter();
    setupHamburgerMenu();
    setupScrollAnimations();
    setupMissionaryModal();
    setupFloatingButtonsBehavior(); // Substitui setupBackToTopButton
    setupNewsModal();
    setupPrayerClock();
    setupContactForm();
    setupPixModal();
    setupPixCopy();
    setupCalendarExport(); // Adiciona a lógica para exportar para o calendário
    loadNews();
    loadMissionaries();
    await loadTitusBoard();
    setupTitusSuggestionModal();
    setupTitusWarningModal();
    loadPublicEvents();
    setupAdminRedirect(); // Adiciona o listener para o redirecionamento secreto
    setupPushNotifications(); // Adiciona a lógica para notificações push
    setupServiceWorker(); // Registra o Service Worker para funcionalidades PWA
})();