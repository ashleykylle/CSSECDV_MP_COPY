// public/js/script.js
document.addEventListener('DOMContentLoaded', function () {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const phoneInput = document.getElementById('phone');
    const profilePhotoInput = document.getElementById('profile-photo');
    const registerButton = document.getElementById('register-button');
    registerButton.disabled = true;
    registerButton.style.backgroundColor = '#808080';

    function areFieldsValid() {
        return isValidEmail(emailInput.value) && 
        isValidPassword(passwordInput.value) && 
        isValidPhoneNo(phoneInput.value) && 
        isValidFileType(profilePhotoInput);
    }

    function updateButtonState() {
        if (areFieldsValid()) {
            registerButton.disabled = false;
            registerButton.style.backgroundColor = '#FF914D';
        } else {
            registerButton.disabled = true;
            registerButton.style.backgroundColor = '#808080';
        }
    }

    emailInput.addEventListener('input', function () {
        const emailErrorContainer = document.getElementById('email-error');
        const isValid = isValidEmail(emailInput.value);

        if (isValid || emailInput.value == '') {
            emailErrorContainer.textContent = ''; // Clear error message when email valid or empty
        }  else {
            emailErrorContainer.textContent = 'Please enter a valid email address.';
        }

        updateButtonState();
    });

    passwordInput.addEventListener('input', function () {
        const passwordErrorContainer = document.getElementById('password-error');
        const isValid = isValidPassword(passwordInput.value);

        if (isValid || passwordInput.value == '') {
            passwordErrorContainer.textContent = ''; // Clear error message when password valid or empty
        } else {
            passwordErrorContainer.textContent = 'Password must be at least 12 characters long and include at least one lowercase letter, one uppercase letter, one number, and one special character.';
        }
        
        updateButtonState();
    });

    phoneInput.addEventListener('input', function () {
        const phoneErrorContainer = document.getElementById('phone-error');
        const isValid = isValidPhoneNo(phoneInput.value);

        if (isValid || phoneInput.value == '') {
            phoneErrorContainer.textContent = ''; // Clear error message when phone valid or empty
        } else {
            phoneErrorContainer.textContent = 'Phone no. must follow the format 09XXXXXXXXX or 639XXXXXXXXX';
        }

        updateButtonState();
    });

    profilePhotoInput.addEventListener('change', function () {

        if (!isValidFileType(profilePhotoInput)) {
            alert('Only JPEG and PNG files are allowed. Please choose a valid image file.');
            // Clear the file input to allow the user to choose a different file
            profilePhotoInput.value = '';
        }

        updateButtonState();
    });

});

// Validate format for email
function isValidEmail(email) {
    return /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/.test(email);
}

// Validate format for password 
function isValidPassword(password){
    //return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,64}$/.test(password);
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{12,64}$/.test(password);
}

// validate format for  phone number
function isValidPhoneNo(phone_no) {
    return /^(09\d{9}|639\d{9})$/.test(phone_no);
}

// validate file type
function isValidFileType(profilePhotoInput) {
    const allowedFileTypes = ['image/jpeg', 'image/png'];
    return profilePhotoInput.files.length > 0 && allowedFileTypes.includes(profilePhotoInput.files[0].type);
}