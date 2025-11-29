// Authentication functions
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginMessage = document.getElementById('loginMessage');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = new URLSearchParams(window.location.search).get('role');
            
            // Show loading state
            loginBtn.disabled = true;
            loginBtn.querySelector('.spinner-border').classList.remove('d-none');
            
            // Sign in with Firebase Auth
            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Check user role in Firestore
                    return db.collection('users').doc(userCredential.user.uid).get();
                })
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        const userRole = userData.role;
                        const urlRole = new URLSearchParams(window.location.search).get('role');
                        
                        // Verify role matches
                        if (userRole === urlRole) {
                            // Store user info in localStorage
                            localStorage.setItem('user', JSON.stringify({
                                uid: doc.id,
                                email: userData.email,
                                name: userData.name,
                                role: userData.role
                            }));
                            
                            // Redirect based on role
                            if (userRole === 'coach') {
                                window.location.href = 'coach-dashboard.html';
                            } else if (userRole === 'admin') {
                                window.location.href = 'admin-dashboard.html';
                            }
                        } else {
                            showMessage('Access denied. Please use the correct login portal.', 'danger');
                            auth.signOut();
                        }
                    } else {
                        showMessage('User data not found.', 'danger');
                        auth.signOut();
                    }
                })
                .catch((error) => {
                    console.error('Login error:', error);
                    showMessage('Login failed: ' + error.message, 'danger');
                })
                .finally(() => {
                    // Reset button state
                    loginBtn.disabled = false;
                    loginBtn.querySelector('.spinner-border').classList.add('d-none');
                });
        });
    }
    
    function showMessage(message, type) {
        loginMessage.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    }
    
    // Check if user is already logged in
    checkAuthState();
});

function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const currentPath = window.location.pathname;
        
        if (user && currentUser.uid) {
            // User is logged in, redirect if on login page
            if (currentPath.includes('login.html') || currentPath.includes('index.html')) {
                if (currentUser.role === 'coach') {
                    window.location.href = 'coach-dashboard.html';
                } else if (currentUser.role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                }
            }
        } else {
            // User is not logged in, redirect to login if on protected pages
            if (currentPath.includes('coach-dashboard.html') || currentPath.includes('admin-dashboard.html')) {
                window.location.href = 'index.html';
            }
        }
    });
}

function logout() {
    auth.signOut().then(() => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}