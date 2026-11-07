const reservationForm = document.getElementById('reservationForm');
const roomSelect = document.getElementById('room');
const roomDetails = document.getElementById('roomDetails');
const studentInput = document.getElementById('students');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const reservationMessage = document.getElementById('reservationMessage');
const reservationList = document.getElementById('reservationList');
const listMessage = document.getElementById('listMessage');
const welcomeMessage = document.getElementById('welcomeMessage');
const logoutButton = document.getElementById('logoutButton');

let currentUser;
let rooms = [];

try {
    currentUser = JSON.parse(sessionStorage.getItem('reserveMeUser'));
} catch {
    sessionStorage.removeItem('reserveMeUser');
}

if (!currentUser || typeof currentUser.nome !== 'string') {
    window.location.replace('index.html');
} else {
    welcomeMessage.textContent = `Olá, ${currentUser.nome}. Gerencie suas solicitações de sala.`;
    initializeReservations();
}

logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem('reserveMeUser');
    window.location.href = 'index.html';
});

function formatarDataLocal(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mostrarMensagem(element, message, success = false) {
    element.textContent = message;
    element.classList.toggle('form-message', success);
    element.classList.toggle('form-error', !success);
    element.classList.add('visible');
}

async function initializeReservations() {
    const now = new Date();
    startInput.min = formatarDataLocal(now);
    endInput.min = formatarDataLocal(now);

    startInput.addEventListener('change', () => {
        endInput.min = startInput.value || formatarDataLocal(new Date());
        if (endInput.value && endInput.value <= startInput.value) {
            endInput.value = '';
        }
    });

    roomSelect.addEventListener('change', updateRoomDetails);
    studentInput.addEventListener('input', updateRoomDetails);
    reservationForm.addEventListener('submit', submitReservation);
    [roomSelect, studentInput, startInput, endInput, reservationForm.elements.purpose]
        .forEach((input) => input.addEventListener('input', () => {
            reservationMessage.classList.remove('visible');
        }));

    try {
        const roomResult = await window.reserveMeApi.request('/salas');
        rooms = roomResult.salas;
        roomSelect.replaceChildren(new Option('Selecione uma sala', ''));

        rooms.forEach((room) => {
            roomSelect.add(new Option(
                `${room.nome} — ${room.capacidade} pessoas`,
                room.id
            ));
        });

        if (rooms.length === 0) {
            roomSelect.replaceChildren(new Option('Nenhuma sala cadastrada', ''));
        }
        updateRoomDetails();
    } catch (error) {
        roomSelect.replaceChildren(new Option('Falha ao carregar salas', ''));
        mostrarMensagem(reservationMessage, error.message);
    }

    try {
        await loadReservations();
    } catch (error) {
        reservationList.replaceChildren();
        mostrarMensagem(listMessage, error.message);
    }
}

function updateRoomDetails() {
    const selectedRoom = rooms.find((room) => room.id === roomSelect.value);
    if (!selectedRoom) {
        roomDetails.textContent = '';
        studentInput.removeAttribute('max');
        return;
    }

    studentInput.max = selectedRoom.capacidade;
    const resources = Array.isArray(selectedRoom.recursos)
        ? selectedRoom.recursos.join(', ')
        : 'Não informado';
    const requestedStudents = Number(studentInput.value);
    const capacityMessage = requestedStudents > selectedRoom.capacidade
        ? ` A turma excede a capacidade em ${requestedStudents - selectedRoom.capacidade} aluno(s).`
        : '';
    roomDetails.textContent = `Andar ${selectedRoom.andar} · Capacidade para ${selectedRoom.capacidade} pessoas · Recursos: ${resources}.${capacityMessage}`;
}

async function loadReservations() {
    const result = await window.reserveMeApi.request('/reservas');
    renderReservations(result.reservas);
}

function formatarDataHora(value) {
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
}

function renderReservations(reservations) {
    reservationList.replaceChildren();
    if (reservations.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'Ainda não há reservas cadastradas.';
        reservationList.append(emptyState);
        return;
    }

    reservations.forEach((reservation) => {
        const card = document.createElement('article');
        card.className = 'reservation-card';

        const title = document.createElement('h3');
        title.textContent = reservation.sala_nome;
        card.append(title);

        const details = [
            `${formatarDataHora(reservation.data_inicio)} até ${formatarDataHora(reservation.data_fim)}`,
            `Responsável: ${reservation.responsavel}`,
            `Alunos: ${reservation.quantidade_alunos}`,
            `Finalidade: ${reservation.finalidade}`
        ];
        details.forEach((text) => {
            const paragraph = document.createElement('p');
            paragraph.textContent = text;
            card.append(paragraph);
        });

        const status = document.createElement('span');
        status.className = `reservation-status ${reservation.situacao}`;
        status.textContent = reservation.situacao;
        card.append(status);
        reservationList.append(card);
    });
}

async function submitReservation(event) {
    event.preventDefault();
    const selectedRoom = rooms.find((room) => room.id === roomSelect.value);
    const requestedStudents = Number(studentInput.value);

    if (!selectedRoom) {
        mostrarMensagem(reservationMessage, 'Selecione uma sala.');
        return;
    }
    if (!Number.isInteger(requestedStudents) || requestedStudents < 1) {
        mostrarMensagem(reservationMessage, 'Informe uma quantidade válida de alunos.');
        studentInput.focus();
        return;
    }
    if (requestedStudents > selectedRoom.capacidade) {
        mostrarMensagem(
            reservationMessage,
            `Essa turma não cabe na sala selecionada (capacidade: ${selectedRoom.capacidade}).`
        );
        studentInput.focus();
        return;
    }
    if (endInput.value <= startInput.value) {
        mostrarMensagem(reservationMessage, 'O horário de fim deve ser posterior ao início.');
        endInput.focus();
        return;
    }

    const submitButton = reservationForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    let reservationCreated = false;
    try {
        await window.reserveMeApi.request('/reservas', {
            method: 'POST',
            body: {
                sala_id: roomSelect.value,
                data_inicio: startInput.value,
                data_fim: endInput.value,
                responsavel: currentUser.nome,
                finalidade: reservationForm.elements.purpose.value.trim(),
                quantidade_alunos: requestedStudents
            }
        });

        mostrarMensagem(
            reservationMessage,
            'Solicitação enviada. A reserva ficou pendente de aprovação.',
            true
        );
        reservationCreated = true;
        reservationForm.reset();
        startInput.min = formatarDataLocal(new Date());
        endInput.min = startInput.min;
        updateRoomDetails();
    } catch (error) {
        mostrarMensagem(reservationMessage, error.message);
    } finally {
        submitButton.disabled = false;
    }

    if (reservationCreated) {
        try {
            await loadReservations();
        } catch (error) {
            mostrarMensagem(listMessage, error.message);
        }
    }
}
