// Dados fictícios (depois trocaremos por dados reais)
const prayerSchedule = [
    { hour: 0, name: "Grupo Jovem" },
    // Gera o resto das horas com voluntários genéricos
    ...Array.from({ length: 23 }, (_, i) => ({ hour: i + 1, name: `Voluntário ${i + 2}` }))
].flat();
// Sobrescreve alguns para ter dados mais realistas
prayerSchedule[1] = { hour: 1, name: "Irmã Maria" };
prayerSchedule[2] = { hour: 2, name: "Pastor João" };
prayerSchedule[3] = { hour: 3, name: "Sem voluntário" };

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
    // Check if we are on a page with missionary cards
    const missionaryCards = document.querySelectorAll('.missionary-card');
    const modal = document.getElementById('missionary-modal');
    if (!missionaryCards.length || !modal) return;

    const modalCloseBtn = modal.querySelector('.modal-close');
    const modalImg = document.getElementById('modal-img');
    const modalName = document.getElementById('modal-name');
    const modalDescription = document.getElementById('modal-description');
    const body = document.body;
    const modalButton = modal.querySelector('.modal-contribute');

    missionaryCards.forEach(card => {
        card.addEventListener('click', () => {
            const name = card.dataset.name;
            const imgSrc = card.dataset.imgSrc;
            const longDesc = card.dataset.longDesc;
            const btnText = card.dataset.btnText;
            const btnLink = card.dataset.btnLink;

            modalName.textContent = name;
            modalDescription.textContent = longDesc;
            modalImg.alt = `Foto de ${name}`;

            if (imgSrc) {
                modalImg.src = imgSrc;
                modalImg.parentElement.style.display = ''; // Garante que o container da imagem seja visível
            } else {
                modalImg.parentElement.style.display = 'none'; // Esconde se não houver imagem
            }

            // Lida com o botão customizado
            if (btnText && btnLink) {
                modalButton.textContent = btnText;
                modalButton.href = btnLink;
                modalButton.target = '_blank';
                modalButton.rel = 'noopener noreferrer';
            } else {
                // Reseta para o padrão para os outros missionários
                modalButton.textContent = 'Contribuir';
                modalButton.href = '#'; // Link de contribuição padrão
                modalButton.removeAttribute('target');
                modalButton.removeAttribute('rel');
            }

            modal.classList.add('is-visible');
            body.classList.add('modal-open');
        });
    });

    function closeModal() {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => e.target === modal && closeModal());
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('is-visible')) closeModal();
    });
}

function setupPrayerClock() {
    const clockFace = document.getElementById('clock-face');
    if (!clockFace) return; // Só executa na página do relógio

    const centerDisplay = document.getElementById('current-prayer');
    const clockTime = document.getElementById('clock');
    const clockHand = document.getElementById('clock-hand');
    const nameListContainer = document.getElementById('prayer-name-list');
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
    const newsCards = document.querySelectorAll('.news-card');
    const modal = document.getElementById('news-modal');
    if (!newsCards.length || !modal) return;

    const modalCloseBtn = modal.querySelector('.modal-close');
    const modalImg = document.getElementById('modal-img');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalFullStory = document.getElementById('modal-full-story');
    const body = document.body;

    newsCards.forEach(card => {
        card.addEventListener('click', () => {
            const title = card.dataset.title;
            const date = card.dataset.date;
            const imgSrc = card.dataset.imgSrc;
            const fullStory = card.dataset.fullStory;

            modalTitle.textContent = title;
            modalFullStory.innerHTML = fullStory; // Use innerHTML para interpretar tags HTML como <p>

            if (date) {
                modalDate.textContent = `Publicado em: ${date}`;
                modalDate.style.display = 'block';
            } else {
                modalDate.style.display = 'none';
            }

            if (imgSrc) {
                modalImg.src = imgSrc;
                modalImg.alt = `Imagem para: ${title}`;
                modalImg.style.display = 'block';
            } else {
                modalImg.style.display = 'none';
            }

            modal.classList.add('is-visible');
            body.classList.add('modal-open');
        });
    });

    function closeModal() {
        modal.classList.remove('is-visible');
        body.classList.remove('modal-open');
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            closeModal();
        }
    });
    document.addEventListener('keydown', e => e.key === 'Escape' && modal.classList.contains('is-visible') && closeModal());
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
    modal.addEventListener('click', e => e.target === modal && closeModal());
    document.addEventListener('keydown', e => e.key === 'Escape' && modal.classList.contains('is-visible') && closeModal());
}

// --- Inicialização de todas as funções ---
updateFooter();
setupHamburgerMenu();
setupScrollAnimations();
setupMissionaryModal();
setupBackToTopButton();
setupNewsModal();
setupPrayerClock();
setupContactForm();