const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailGroup = emailInput.closest('.input-group');
const passwordGroup = passwordInput.closest('.input-group');
const validationMessage = document.getElementById('loginValidationMessage');

const query = new URLSearchParams(window.location.search);
if (query.get('cadastro') === 'sucesso') {
    emailInput.value = query.get('email') || '';
    validationMessage.classList.remove('form-error');
    validationMessage.classList.add('form-message', 'visible');
    validationMessage.textContent = 'Conta criada com sucesso. Entre com sua senha.';
}

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const emailIsValid = emailInput.value.trim() && emailInput.validity.valid;
    const passwordIsValid = passwordInput.value.trim();

    emailGroup.classList.toggle('error', !emailIsValid);
    passwordGroup.classList.toggle('error', !passwordIsValid);
    validationMessage.classList.remove('form-message');
    validationMessage.classList.add('form-error');

    if (!emailIsValid || !passwordIsValid) {
        validationMessage.textContent = 'Preencha os campos obrigatórios corretamente.';
        validationMessage.classList.add('visible');
        (emailIsValid ? passwordInput : emailInput).focus();
        return;
    }

    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const result = await window.reserveMeApi.request('/auth/login', {
            method: 'POST',
            body: {
                email: emailInput.value.trim(),
                senha: passwordInput.value
            }
        });
        sessionStorage.setItem('reserveMeUser', JSON.stringify(result.user));
        window.location.href = 'reservas.html';
    } catch (error) {
        validationMessage.classList.remove('form-message');
        validationMessage.classList.add('form-error');
        validationMessage.textContent = error.message;
        validationMessage.classList.add('visible');
    } finally {
        submitButton.disabled = false;
    }
});

[emailInput, passwordInput].forEach(function(input) {
    input.addEventListener('input', function() {
        input.closest('.input-group').classList.remove('error');
        validationMessage.classList.remove('form-message');
        validationMessage.classList.add('form-error');
        validationMessage.classList.remove('visible');
    });
});