const registerForm = document.getElementById('registerForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const registerMessage = document.getElementById('registerValidationMessage');

registerForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const nameIsValid = nameInput.value.trim().length >= 2;
    const emailIsValid = emailInput.value.trim() && emailInput.validity.valid;
    const passwordIsValid = passwordInput.value.length >= 8;
    const passwordsMatch = passwordInput.value === confirmPasswordInput.value;

    nameInput.closest('.input-group').classList.toggle('error', !nameIsValid);
    emailInput.closest('.input-group').classList.toggle('error', !emailIsValid);
    passwordInput.closest('.input-group').classList.toggle('error', !passwordIsValid);
    confirmPasswordInput.closest('.input-group').classList.toggle('error', !passwordsMatch);

    if (!nameIsValid || !emailIsValid || !passwordIsValid || !passwordsMatch) {
        registerMessage.textContent = 'Confira os campos destacados e tente novamente.';
        registerMessage.classList.add('visible');
        return;
    }

    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        await window.reserveMeApi.request('/auth/register', {
            method: 'POST',
            body: {
                nome: nameInput.value.trim(),
                email: emailInput.value.trim(),
                senha: passwordInput.value
            }
        });

        const query = new URLSearchParams({
            cadastro: 'sucesso',
            email: emailInput.value.trim()
        });
        window.location.href = `index.html?${query}`;
    } catch (error) {
        registerMessage.textContent = error.message;
        registerMessage.classList.add('visible');
    } finally {
        submitButton.disabled = false;
    }
});

[nameInput, emailInput, passwordInput, confirmPasswordInput].forEach((input) => {
    input.addEventListener('input', () => {
        input.closest('.input-group').classList.remove('error');
        registerMessage.classList.remove('visible');
    });
});
