const recoveryForm = document.getElementById('recoveryForm');
const emailInput = document.getElementById('email');
const emailGroup = emailInput.closest('.input-group');
const formMessage = document.getElementById('formMessage');
const validationMessage = document.getElementById('validationMessage');

recoveryForm.addEventListener('submit', function(event) {
    event.preventDefault();

    if (!emailInput.value.trim() || !emailInput.validity.valid) {
        emailGroup.classList.add('error');
        validationMessage.textContent = 'Informe um e-mail válido para continuar.';
        validationMessage.classList.add('visible');
        formMessage.classList.remove('visible');
        emailInput.focus();
        return;
    }

    emailGroup.classList.remove('error');
    validationMessage.classList.remove('visible');
    formMessage.textContent = 'O envio das instruções ainda não está conectado à API.';
    formMessage.classList.add('visible');
});

emailInput.addEventListener('input', function() {
    emailGroup.classList.remove('error');
    validationMessage.classList.remove('visible');
    formMessage.classList.remove('visible');
});
