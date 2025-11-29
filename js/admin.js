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
    console.log("Loading admin stats...");
    
    // Total Coaches
    db.collection('users')
        .where('role', '==', 'coach')
        .get()
        .then((querySnapshot) => {
            console.log("Coaches found:", querySnapshot.size);
            document.getElementById('totalCoaches').textContent = querySnapshot.size;
        })
        .catch((error) => {
            console.error('Error loading coaches count:', error);
            document.getElementById('totalCoaches').textContent = '0';
        });
    
    // Total Students
    db.collection('students')
        .get()
        .then((querySnapshot) => {
            console.log("Students found:", querySnapshot.size);
            document.getElementById('totalStudents').textContent = querySnapshot.size;
        })
        .catch((error) => {
            console.error('Error loading students count:', error);
            document.getElementById('totalStudents').textContent = '0';
        });
    
    // Total Classes and Revenue
    db.collection('classes')
        .get()
        .then((querySnapshot) => {
            console.log("Classes found:", querySnapshot.size);
            
            let totalClasses = 0;
            let totalRevenue = 0;
            
            querySnapshot.forEach((doc) => {
                totalClasses++;
                const classFee = parseFloat(doc.data().classFee) || 0;
                totalRevenue += classFee;
            });
            
            document.getElementById('totalClasses').textContent = totalClasses;
            document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toFixed(2)}`;
        })
        .catch((error) => {
            console.error('Error loading classes count:', error);
            document.getElementById('totalClasses').textContent = '0';
            document.getElementById('totalRevenue').textContent = '₹0';
        });
}

function loadRecentClasses() {
    const tableBody = document.getElementById('recentClassesTable');
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    
    db.collection('classes')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
        .then((querySnapshot) => {
            tableBody.innerHTML = '';
            
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No classes found</td></tr>';
                return;
            }
            
            const classPromises = [];
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                classData.id = doc.id;
                
                const promise = new Promise((resolve) => {
                    // Get coach name
                    let coachName = 'Unknown Coach';
                    const coachPromise = classData.coachId ? 
                        db.collection('users').doc(classData.coachId).get() : 
                        Promise.resolve({ exists: false });
                    
                    // Get student name for individual classes
                    let studentName = classData.classType === 'individual' ? 'Unknown Student' : 'Group Session';
                    const studentPromise = (classData.classType === 'individual' && classData.studentId) ? 
                        db.collection('students').doc(classData.studentId).get() : 
                        Promise.resolve({ exists: false });
                    
                    Promise.all([coachPromise, studentPromise])
                        .then(([coachDoc, studentDoc]) => {
                            if (coachDoc.exists) {
                                coachName = coachDoc.data().name;
                            }
                            if (studentDoc.exists) {
                                studentName = studentDoc.data().name;
                            }
                            
                            const row = document.createElement('tr');
                            
                            // Format date
                            let classDate;
                            if (classData.classDate && classData.classDate.seconds) {
                                classDate = new Date(classData.classDate.seconds * 1000);
                            } else {
                                classDate = new Date(classData.classDate);
                            }
                            const formattedDate = classDate.toLocaleDateString('en-IN');
                            
                            row.innerHTML = `
                                <td>${formattedDate}</td>
                                <td>${coachName}</td>
                                <td>${studentName}</td>
                                <td>${classData.classType.charAt(0).toUpperCase() + classData.classType.slice(1)}</td>
                                <td>${classData.duration} mins</td>
                                <td>₹${classData.classFee}</td>
                            `;
                            
                            tableBody.appendChild(row);
                            resolve();
                        });
                });
                
                classPromises.push(promise);
            });
            
            return Promise.all(classPromises);
        })
        .catch((error) => {
            console.error('Error loading recent classes:', error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading classes</td></tr>';
        });
}

function loadCoaches() {
    const tableBody = document.getElementById('coachesTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
    
    db.collection('users')
        .where('role', '==', 'coach')
        .get()
        .then((querySnapshot) => {
            tableBody.innerHTML = '';
            
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
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading coaches</td></tr>';
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
                })
                .catch((error) => {
                    console.error('Error populating coach selects:', error);
                });
        }
    });
}

function loadStudents() {
    const tableBody = document.getElementById('studentsTableBody');
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    
    db.collection('students')
        .get()
        .then((querySnapshot) => {
            tableBody.innerHTML = '';
            
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No students found</td></tr>';
                return;
            }
            
            const studentPromises = [];
            
            querySnapshot.forEach((doc) => {
                const student = doc.data();
                const studentId = doc.id;
                
                const promise = new Promise((resolve) => {
                    // Get assigned coach name
                    let coachName = 'Not Assigned';
                    let coachId = null;
                    
                    // Check assignments for this student
                    db.collection('assignments')
                        .where('studentId', '==', studentId)
                        .where('status', '==', 'active')
                        .get()
                        .then((assignmentsSnapshot) => {
                            if (assignmentsSnapshot.size > 0) {
                                const assignment = assignmentsSnapshot.docs[0].data();
                                coachId = assignment.coachId;
                                
                                return db.collection('users').doc(coachId).get();
                            } else {
                                return Promise.resolve({ exists: false });
                            }
                        })
                        .then((coachDoc) => {
                            if (coachDoc.exists) {
                                coachName = coachDoc.data().name;
                            }
                            
                            const row = document.createElement('tr');
                            
                            row.innerHTML = `
                                <td>${student.name}</td>
                                <td>${student.email || 'N/A'}</td>
                                <td>${student.phone || 'N/A'}</td>
                                <td>${student.parentName || 'N/A'}</td>
                                <td>${coachName}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="assignStudent('${studentId}', '${student.name.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-user-plus"></i> Assign
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${studentId}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            `;
                            
                            tableBody.appendChild(row);
                            resolve();
                        });
                });
                
                studentPromises.push(promise);
            });
            
            return Promise.all(studentPromises);
        })
        .catch((error) => {
            console.error('Error loading students:', error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading students</td></tr>';
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
    
    // Show loading state
    const saveBtn = document.getElementById('saveCoachBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    
    console.log("Creating coach:", { name, email });
    
    // Create coach in Firebase Auth
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const userId = userCredential.user.uid;
            console.log("Coach created in Auth with ID:", userId);
            
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
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCoachModal'));
            if (modal) modal.hide();
            
            // Refresh data
            loadCoaches();
            loadStats();
        })
        .catch((error) => {
            console.error('Error adding coach:', error);
            alert('Error adding coach: ' + error.message);
        })
        .finally(() => {
            // Reset button state
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Coach';
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
    
    // Show loading state
    const saveBtn = document.getElementById('saveStudentBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    
    const studentData = {
        name: name,
        email: email || '',
        phone: phone || '',
        parentName: parentName || '',
        parentPhone: parentPhone || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log("Saving student:", studentData);
    
    // Save student to Firestore
    db.collection('students').add(studentData)
        .then((studentDoc) => {
            console.log("Student saved with ID:", studentDoc.id);
            
            // If coach is assigned, create assignment
            if (assignedCoachId) {
                return db.collection('assignments').add({
                    coachId: assignedCoachId,
                    studentId: studentDoc.id,
                    assignedDate: new Date(),
                    status: 'active'
                }).then(() => {
                    console.log("Assignment created for coach:", assignedCoachId);
                });
            }
        })
        .then(() => {
            alert('Student added successfully!');
            document.getElementById('addStudentForm').reset();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
            if (modal) modal.hide();
            
            // Refresh data
            loadStudents();
            loadStats();
        })
        .catch((error) => {
            console.error('Error adding student:', error);
            alert('Error adding student: ' + error.message);
        })
        .finally(() => {
            // Reset button state
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Student';
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
        })
        .catch((error) => {
            console.error('Error loading coaches for assignment:', error);
            alert('Error loading coaches: ' + error.message);
        });
}

function saveAssignment() {
    const studentId = document.getElementById('assignStudentId').value;
    const coachId = document.getElementById('assignToCoach').value;
    
    if (!studentId || !coachId) {
        alert('Please select a coach');
        return;
    }
    
    // Show loading state
    const saveBtn = document.getElementById('saveAssignmentBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    
    console.log("Assigning student", studentId, "to coach", coachId);
    
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
            alert('Student assigned successfully!');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('assignStudentModal'));
            if (modal) modal.hide();
            
            // Refresh students list
            loadStudents();
        })
        .catch((error) => {
            console.error('Error assigning student:', error);
            alert('Error assigning student: ' + error.message);
        })
        .finally(() => {
            // Reset button state
            saveBtn.disabled = false;
            saveBtn.textContent = 'Assign';
        });
}

function deleteCoach(coachId) {
    if (confirm('Are you sure you want to delete this coach? This will remove them from the system.')) {
        // Delete coach from Firestore
        db.collection('users').doc(coachId).delete()
            .then(() => {
                alert('Coach deleted successfully!');
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
                alert('Student deleted successfully!');
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
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    
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
    
    query.orderBy('createdAt', 'desc').get()
        .then((querySnapshot) => {
            tableBody.innerHTML = '';
            
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No classes found</td></tr>';
                return;
            }
            
            const reportPromises = [];
            
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
                
                const promise = new Promise((resolve) => {
                    // Get coach name
                    let coachName = 'Unknown Coach';
                    const coachPromise = classData.coachId ? 
                        db.collection('users').doc(classData.coachId).get() : 
                        Promise.resolve({ exists: false });
                    
                    // Get student name for individual classes
                    let studentName = classData.classType === 'individual' ? 'Unknown Student' : 'Group Session';
                    const studentPromise = (classData.classType === 'individual' && classData.studentId) ? 
                        db.collection('students').doc(classData.studentId).get() : 
                        Promise.resolve({ exists: false });
                    
                    Promise.all([coachPromise, studentPromise])
                        .then(([coachDoc, studentDoc]) => {
                            if (coachDoc.exists) {
                                coachName = coachDoc.data().name;
                            }
                            if (studentDoc.exists) {
                                studentName = studentDoc.data().name;
                            }
                            
                            const row = document.createElement('tr');
                            
                            // Format date
                            let classDate;
                            if (classData.classDate && classData.classDate.seconds) {
                                classDate = new Date(classData.classDate.seconds * 1000);
                            } else {
                                classDate = new Date(classData.classDate);
                            }
                            const formattedDate = classDate.toLocaleDateString('en-IN');
                            
                            row.innerHTML = `
                                <td>${formattedDate}</td>
                                <td>${coachName}</td>
                                <td>${studentName}</td>
                                <td>${classData.classType.charAt(0).toUpperCase() + classData.classType.slice(1)}</td>
                                <td>${classData.duration} mins</td>
                                <td>₹${classData.classFee}</td>
                            `;
                            
                            tableBody.appendChild(row);
                            resolve();
                        });
                });
                
                reportPromises.push(promise);
            });
            
            return Promise.all(reportPromises);
        })
        .catch((error) => {
            console.error('Error loading reports:', error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading reports</td></tr>';
        });
}

// Add to existing admin.js - NEW FUNCTIONS FOR PAYMENT MANAGEMENT

function showCoachPayments() {
    // Load coaches for payment management
    loadCoachesForPayments();
    
    // Show modal
    new bootstrap.Modal(document.getElementById('coachPaymentsModal')).show();
}

function loadCoachesForPayments() {
    const coachSelect = document.getElementById('paymentCoachSelect');
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
        })
        .catch((error) => {
            console.error('Error loading coaches for payments:', error);
        });
}

function loadCoachClassesForPayment() {
    const coachId = document.getElementById('paymentCoachSelect').value;
    const startDate = document.getElementById('paymentStartDate').value;
    const endDate = document.getElementById('paymentEndDate').value;
    
    if (!coachId) {
        alert('Please select a coach');
        return;
    }
    
    const tableBody = document.getElementById('coachClassesTableBody');
    tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    
    let query = db.collection('classes').where('coachId', '==', coachId);
    
    query.get()
        .then((querySnapshot) => {
            tableBody.innerHTML = '';
            
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No classes found for this coach</td></tr>';
                return;
            }
            
            let totalPending = 0;
            let totalCompleted = 0;
            const classPromises = [];
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                classData.id = doc.id;
                
                // Date filtering
                let classDate;
                if (classData.classDate && classData.classDate.seconds) {
                    classDate = new Date(classData.classDate.seconds * 1000);
                } else {
                    classDate = new Date(classData.classDate);
                }
                
                // Apply date filter if provided
                if (startDate && classDate < new Date(startDate)) {
                    return;
                }
                if (endDate && classDate > new Date(endDate + 'T23:59:59')) {
                    return;
                }
                
                const promise = new Promise((resolve) => {
                    // Get student name
                    let studentName = classData.classType === 'individual' ? 'Unknown Student' : 'Group Session';
                    const studentPromise = (classData.classType === 'individual' && classData.studentId) ? 
                        db.collection('students').doc(classData.studentId).get() : 
                        Promise.resolve({ exists: false });
                    
                    studentPromise.then((studentDoc) => {
                        if (studentDoc.exists) {
                            studentName = studentDoc.data().name;
                        }
                        
                        const paymentStatus = classData.paymentStatus || 'pending';
                        const classFee = parseFloat(classData.classFee) || 0;
                        
                        // Update totals
                        if (paymentStatus === 'completed') {
                            totalCompleted += classFee;
                        } else {
                            totalPending += classFee;
                        }
                        
                        const row = document.createElement('tr');
                        const formattedDate = classDate.toLocaleDateString('en-IN');
                        
                        const statusBadge = paymentStatus === 'completed' ? 
                            '<span class="badge bg-success">Completed</span>' : 
                            '<span class="badge bg-warning">Pending</span>';
                        
                        const paymentAction = paymentStatus === 'pending' ? 
                            `<button class="btn btn-sm btn-success" onclick="markPaymentComplete('${doc.id}')">
                                <i class="fas fa-check"></i> Mark Paid
                            </button>` :
                            `<button class="btn btn-sm btn-warning" onclick="markPaymentPending('${doc.id}')">
                                <i class="fas fa-clock"></i> Mark Pending
                            </button>`;
                        
                        row.innerHTML = `
                            <td>${formattedDate}</td>
                            <td>${studentName}</td>
                            <td>${classData.classType.charAt(0).toUpperCase() + classData.classType.slice(1)}</td>
                            <td>${classData.duration} mins</td>
                            <td>₹${classFee}</td>
                            <td>${statusBadge}</td>
                            <td>${paymentAction}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteClassAdmin('${doc.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        
                        tableBody.appendChild(row);
                        resolve();
                    });
                });
                
                classPromises.push(promise);
            });
            
            return Promise.all(classPromises);
        })
        .then(() => {
            // Update payment summary
            document.getElementById('totalPendingAmount').textContent = `₹${totalPending.toFixed(2)}`;
            document.getElementById('totalCompletedAmount').textContent = `₹${totalCompleted.toFixed(2)}`;
            document.getElementById('totalOverallAmount').textContent = `₹${(totalPending + totalCompleted).toFixed(2)}`;
        })
        .catch((error) => {
            console.error('Error loading coach classes:', error);
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading classes</td></tr>';
        });
}

function markPaymentComplete(classId) {
    if (confirm('Mark this payment as completed?')) {
        db.collection('classes').doc(classId).update({
            paymentStatus: 'completed',
            paymentCompletedAt: new Date()
        })
        .then(() => {
            alert('Payment marked as completed!');
            loadCoachClassesForPayment(); // Refresh the list
        })
        .catch((error) => {
            console.error('Error updating payment status:', error);
            alert('Error updating payment status: ' + error.message);
        });
    }
}

function markPaymentPending(classId) {
    if (confirm('Mark this payment as pending?')) {
        db.collection('classes').doc(classId).update({
            paymentStatus: 'pending',
            paymentCompletedAt: null
        })
        .then(() => {
            alert('Payment marked as pending!');
            loadCoachClassesForPayment(); // Refresh the list
        })
        .catch((error) => {
            console.error('Error updating payment status:', error);
            alert('Error updating payment status: ' + error.message);
        });
    }
}

function deleteClassAdmin(classId) {
    if (confirm('Are you sure you want to delete this class?')) {
        db.collection('classes').doc(classId).delete()
            .then(() => {
                alert('Class deleted successfully!');
                loadCoachClassesForPayment(); // Refresh the list
            })
            .catch((error) => {
                console.error('Error deleting class:', error);
                alert('Error deleting class: ' + error.message);
            });
    }
}

function exportCoachPayments() {
    const coachId = document.getElementById('paymentCoachSelect').value;
    if (!coachId) {
        alert('Please select a coach first');
        return;
    }
    
    // Simple CSV export
    let csvContent = "Date,Student,Type,Duration,Fee,Status\n";
    
    const rows = document.querySelectorAll('#coachClassesTableBody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
            const rowData = [
                cells[0].textContent,
                cells[1].textContent,
                cells[2].textContent,
                cells[3].textContent,
                cells[4].textContent,
                cells[5].textContent.replace('Completed', 'Paid').replace('Pending', 'Unpaid')
            ];
            csvContent += rowData.join(',') + '\n';
        }
    });
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coach-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}
