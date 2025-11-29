// Admin dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.uid || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    // Set welcome message
    document.getElementById('welcomeMessage').textContent = `Welcome, ${user.name}`;
    
    // Load admin data
    loadAdminData();
    
    // Set up event listeners
    document.getElementById('saveCoachBtn').addEventListener('click', saveCoach);
    document.getElementById('saveStudentBtn').addEventListener('click', saveStudent);
    document.getElementById('saveAssignmentBtn').addEventListener('click', saveAssignment);
    
    // Report filters
    document.getElementById('reportCoach')?.addEventListener('change', loadReports);
    document.getElementById('reportMonth')?.addEventListener('change', loadReports);
    document.getElementById('reportType')?.addEventListener('change', loadReports);
});

function loadAdminData() {
    // Load stats
    loadStats();
    
    // Load recent classes
    loadRecentClasses();
    
    // Load coaches for management
    loadCoaches();
    
    // Load students for management
    loadStudents();
}

function loadStats() {
    // Total Coaches
    db.collection('users')
        .where('role', '==', 'coach')
        .get()
        .then((querySnapshot) => {
            document.getElementById('totalCoaches').textContent = querySnapshot.size;
        });
    
    // Total Students
    db.collection('students')
        .get()
        .then((querySnapshot) => {
            document.getElementById('totalStudents').textContent = querySnapshot.size;
        });
    
    // Total Classes and Revenue
    db.collection('classes')
        .get()
        .then((querySnapshot) => {
            let totalClasses = 0;
            let totalRevenue = 0;
            
            querySnapshot.forEach((doc) => {
                totalClasses++;
                totalRevenue += parseFloat(doc.data().classFee) || 0;
            });
            
            document.getElementById('totalClasses').textContent = totalClasses;
            document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toFixed(2)}`;
        });
}

function loadRecentClasses() {
    const tableBody = document.getElementById('recentClassesTable');
    tableBody.innerHTML = '';
    
    db.collection('classes')
        .orderBy('classDate', 'desc')
        .limit(10)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No classes found</td></tr>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                const row = document.createElement('tr');
                
                // Format date
                const classDate = new Date(classData.classDate.seconds * 1000);
                const formattedDate = classDate.toLocaleDateString('en-IN');
                
                // Get coach name
                let coachName = 'Unknown Coach';
                if (classData.coachId) {
                    db.collection('users').doc(classData.coachId).get()
                        .then((coachDoc) => {
                            if (coachDoc.exists) {
                                coachName = coachDoc.data().name;
                                row.cells[1].textContent = coachName;
                            }
                        });
                }
                
                // Get student name for individual classes
                let studentName = classData.classType === 'individual' ? 'Unknown Student' : 'Group Session';
                if (classData.classType === 'individual' && classData.studentId) {
                    db.collection('students').doc(classData.studentId).get()
                        .then((studentDoc) => {
                            if (studentDoc.exists) {
                                studentName = studentDoc.data().name;
                                row.cells[2].textContent = studentName;
                            }
                        });
                }
                
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${coachName}</td>
                    <td>${studentName}</td>
                    <td>${classData.classType.charAt(0).toUpperCase() + classData.classType.slice(1)}</td>
                    <td>${classData.duration} mins</td>
                    <td>₹${classData.classFee}</td>
                `;
                
                tableBody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading recent classes:', error);
        });
}

function loadCoaches() {
    const tableBody = document.getElementById('coachesTableBody');
    tableBody.innerHTML = '';
    
    db.collection('users')
        .where('role', '==', 'coach')
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No coaches found</td></tr>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const coach = doc.data();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${coach.name}</td>
                    <td>${coach.email}</td>
                    <td>${coach.phone || 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCoach('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Also populate coach selects
            populateCoachSelects();
        })
        .catch((error) => {
            console.error('Error loading coaches:', error);
        });
}

function populateCoachSelects() {
    const coachSelects = [
        document.getElementById('assignCoach'),
        document.getElementById('assignToCoach'),
        document.getElementById('reportCoach')
    ];
    
    coachSelects.forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">Select Coach</option>';
            
            db.collection('users')
                .where('role', '==', 'coach')
                .get()
                .then((querySnapshot) => {
                    querySnapshot.forEach((doc) => {
                        const coach = doc.data();
                        const option = document.createElement('option');
                        option.value = doc.id;
                        option.textContent = coach.name;
                        select.appendChild(option);
                    });
                });
        }
    });
}

function loadStudents() {
    const tableBody = document.getElementById('studentsTableBody');
    tableBody.innerHTML = '';
    
    db.collection('students')
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No students found</td></tr>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const student = doc.data();
                const row = document.createElement('tr');
                
                // Get assigned coach name
                let coachName = 'Not Assigned';
                if (student.assignedCoachId) {
                    db.collection('users').doc(student.assignedCoachId).get()
                        .then((coachDoc) => {
                            if (coachDoc.exists) {
                                coachName = coachDoc.data().name;
                                row.cells[4].textContent = coachName;
                            }
                        });
                }
                
                row.innerHTML = `
                    <td>${student.name}</td>
                    <td>${student.email || 'N/A'}</td>
                    <td>${student.phone || 'N/A'}</td>
                    <td>${student.parentName || 'N/A'}</td>
                    <td>${coachName}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="assignStudent('${doc.id}', '${student.name}')">
                            <i class="fas fa-user-plus"></i> Assign
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading students:', error);
        });
}

function saveCoach() {
    const name = document.getElementById('coachName').value;
    const email = document.getElementById('coachEmail').value;
    const phone = document.getElementById('coachPhone').value;
    const password = document.getElementById('coachPassword').value;
    
    if (!name || !email || !password) {
        alert('Please fill all required fields');
        return;
    }
    
    // Create coach in Firebase Auth
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const userId = userCredential.user.uid;
            
            // Save coach data to Firestore
            return db.collection('users').doc(userId).set({
                name: name,
                email: email,
                phone: phone,
                role: 'coach',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            alert('Coach added successfully!');
            document.getElementById('addCoachForm').reset();
            document.getElementById('addCoachModal').querySelector('.btn-close').click();
            loadCoaches();
            loadStats(); // Refresh stats
        })
        .catch((error) => {
            console.error('Error adding coach:', error);
            alert('Error adding coach: ' + error.message);
        });
}

function saveStudent() {
    const name = document.getElementById('studentName').value;
    const email = document.getElementById('studentEmail').value;
    const phone = document.getElementById('studentPhone').value;
    const parentName = document.getElementById('parentName').value;
    const parentPhone = document.getElementById('parentPhone').value;
    const assignedCoachId = document.getElementById('assignCoach').value;
    
    if (!name) {
        alert('Please fill at least the student name');
        return;
    }
    
    const studentData = {
        name: name,
        email: email,
        phone: phone,
        parentName: parentName,
        parentPhone: parentPhone,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Save student to Firestore
    db.collection('students').add(studentData)
        .then((studentDoc) => {
            // If coach is assigned, create assignment
            if (assignedCoachId) {
                return db.collection('assignments').add({
                    coachId: assignedCoachId,
                    studentId: studentDoc.id,
                    assignedDate: new Date(),
                    status: 'active'
                }).then(() => {
                    // Update student with coach assignment
                    return studentDoc.update({
                        assignedCoachId: assignedCoachId
                    });
                });
            }
        })
        .then(() => {
            alert('Student added successfully!');
            document.getElementById('addStudentForm').reset();
            document.getElementById('addStudentModal').querySelector('.btn-close').click();
            loadStudents();
            loadStats(); // Refresh stats
        })
        .catch((error) => {
            console.error('Error adding student:', error);
            alert('Error adding student: ' + error.message);
        });
}

function assignStudent(studentId, studentName) {
    document.getElementById('assignStudentId').value = studentId;
    document.getElementById('assignStudentName').textContent = studentName;
    
    // Populate coach select
    const coachSelect = document.getElementById('assignToCoach');
    coachSelect.innerHTML = '<option value="">Select Coach</option>';
    
    db.collection('users')
        .where('role', '==', 'coach')
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const coach = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = coach.name;
                coachSelect.appendChild(option);
            });
            
            // Show modal
            new bootstrap.Modal(document.getElementById('assignStudentModal')).show();
        });
}

function saveAssignment() {
    const studentId = document.getElementById('assignStudentId').value;
    const coachId = document.getElementById('assignToCoach').value;
    
    if (!studentId || !coachId) {
        alert('Please select a coach');
        return;
    }
    
    // Check if assignment already exists
    db.collection('assignments')
        .where('studentId', '==', studentId)
        .where('status', '==', 'active')
        .get()
        .then((querySnapshot) => {
            // Deactivate existing assignments
            const updates = [];
            querySnapshot.forEach((doc) => {
                updates.push(doc.ref.update({ status: 'inactive' }));
            });
            
            return Promise.all(updates);
        })
        .then(() => {
            // Create new assignment
            return db.collection('assignments').add({
                coachId: coachId,
                studentId: studentId,
                assignedDate: new Date(),
                status: 'active'
            });
        })
        .then(() => {
            // Update student record
            return db.collection('students').doc(studentId).update({
                assignedCoachId: coachId
            });
        })
        .then(() => {
            alert('Student assigned successfully!');
            document.getElementById('assignStudentModal').querySelector('.btn-close').click();
            loadStudents();
        })
        .catch((error) => {
            console.error('Error assigning student:', error);
            alert('Error assigning student: ' + error.message);
        });
}

function deleteCoach(coachId) {
    if (confirm('Are you sure you want to delete this coach? This action cannot be undone.')) {
        // Delete coach from Firestore
        db.collection('users').doc(coachId).delete()
            .then(() => {
                // Note: To delete from Authentication, you need Admin SDK (server-side)
                // For now, we'll just remove from Firestore
                loadCoaches();
                loadStats();
            })
            .catch((error) => {
                console.error('Error deleting coach:', error);
                alert('Error deleting coach: ' + error.message);
            });
    }
}

function deleteStudent(studentId) {
    if (confirm('Are you sure you want to delete this student?')) {
        db.collection('students').doc(studentId).delete()
            .then(() => {
                // Also deactivate assignments
                return db.collection('assignments')
                    .where('studentId', '==', studentId)
                    .get()
                    .then((querySnapshot) => {
                        const updates = [];
                        querySnapshot.forEach((doc) => {
                            updates.push(doc.ref.update({ status: 'inactive' }));
                        });
                        return Promise.all(updates);
                    });
            })
            .then(() => {
                loadStudents();
                loadStats();
            })
            .catch((error) => {
                console.error('Error deleting student:', error);
                alert('Error deleting student: ' + error.message);
            });
    }
}

function viewReports() {
    // Load initial reports
    loadReports();
    
    // Show modal
    new bootstrap.Modal(document.getElementById('reportsModal')).show();
}

function loadReports() {
    const tableBody = document.getElementById('reportsTableBody');
    tableBody.innerHTML = '';
    
    let query = db.collection('classes');
    
    // Apply filters
    const coachFilter = document.getElementById('reportCoach').value;
    const monthFilter = document.getElementById('reportMonth').value;
    const typeFilter = document.getElementById('reportType').value;
    
    if (coachFilter) {
        query = query.where('coachId', '==', coachFilter);
    }
    
    if (typeFilter) {
        query = query.where('classType', '==', typeFilter);
    }
    
    query.orderBy('classDate', 'desc').get()
        .then((querySnapshot) => {
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No classes found</td></tr>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                
                // Apply month filter client-side
                if (monthFilter) {
                    const classDate = new Date(classData.classDate.seconds * 1000);
                    const classMonth = classDate.getFullYear() + '-' + String(classDate.getMonth() + 1).padStart(2, '0');
                    if (classMonth !== monthFilter) {
                        return; // Skip this class
                    }
                }
                
                const row = document.createElement('tr');
                
                // Format date
                const classDate = new Date(classData.classDate.seconds * 1000);
                const formattedDate = classDate.toLocaleDateString('en-IN');
                
                // Get coach name
                let coachName = 'Unknown Coach';
                if (classData.coachId) {
                    db.collection('users').doc(classData.coachId).get()
                        .then((coachDoc) => {
                            if (coachDoc.exists) {
                                coachName = coachDoc.data().name;
                                row.cells[1].textContent = coachName;
                            }
                        });
                }
                
                // Get student name for individual classes
                let studentName = classData.classType === 'individual' ? 'Unknown Student' : 'Group Session';
                if (classData.classType === 'individual' && classData.studentId) {
                    db.collection('students').doc(classData.studentId).get()
                        .then((studentDoc) => {
                            if (studentDoc.exists) {
                                studentName = studentDoc.data().name;
                                row.cells[2].textContent = studentName;
                            }
                        });
                }
                
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${coachName}</td>
                    <td>${studentName}</td>
                    <td>${classData.classType.charAt(0).toUpperCase() + classData.classType.slice(1)}</td>
                    <td>${classData.duration} mins</td>
                    <td>₹${classData.classFee}</td>
                `;
                
                tableBody.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading reports:', error);
        });
}