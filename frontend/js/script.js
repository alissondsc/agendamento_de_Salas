const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailGroup = emailInput.closest('.input-group');
const passwordGroup = passwordInput.closest('.input-group');
const validationMessage = document.getElementById('loginValidationMessage');

loginForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const emailIsValid = emailInput.value.trim() && emailInput.validity.valid;
    const passwordIsValid = passwordInput.value.trim();

    emailGroup.classList.toggle('error', !emailIsValid);
    passwordGroup.classList.toggle('error', !passwordIsValid);

    if (!emailIsValid || !passwordIsValid) {
        validationMessage.textContent = 'Preencha os campos obrigatórios corretamente.';
        validationMessage.classList.add('visible');
        (emailIsValid ? passwordInput : emailInput).focus();
        return;
    }

    validationMessage.textContent = 'A autenticação ainda não está conectada à API.';
    validationMessage.classList.add('visible');
});

[emailInput, passwordInput].forEach(function(input) {
    input.addEventListener('input', function() {
        input.closest('.input-group').classList.remove('error');
        validationMessage.classList.remove('visible');
    });
});