// Coach dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.uid || user.role !== 'coach') {
        window.location.href = 'index.html';
        return;
    }
    
    // Set welcome message
    document.getElementById('welcomeMessage').textContent = `Welcome, ${user.name}`;
    
    // Load coach data
    loadCoachData(user.uid);
    
    // Set up event listeners
    document.getElementById('saveClassBtn').addEventListener('click', saveClass);
    document.getElementById('classType').addEventListener('change', toggleStudentSelect);
    document.getElementById('viewStudentsBtn').addEventListener('click', showStudentsModal);
    
    // Set today's date as default for class date
    document.getElementById('classDate').valueAsDate = new Date();
});

function loadCoachData(coachId) {
    // Load assigned students
    db.collection('assignments')
        .where('coachId', '==', coachId)
        .where('status', '==', 'active')
        .get()
        .then((querySnapshot) => {
            const studentSelect = document.getElementById('studentSelect');
            studentSelect.innerHTML = '<option value="">Select Student</option>';
            
            querySnapshot.forEach((doc) => {
                const assignment = doc.data();
                // Get student details
                db.collection('students').doc(assignment.studentId).get()
                    .then((studentDoc) => {
                        if (studentDoc.exists) {
                            const student = studentDoc.data();
                            const option = document.createElement('option');
                            option.value = studentDoc.id;
                            option.textContent = student.name;
                            studentSelect.appendChild(option);
                        }
                    });
            });
            
            // Update student count
            document.getElementById('totalStudents').textContent = querySnapshot.size;
        })
        .catch((error) => {
            console.error('Error loading students:', error);
        });
    
    // Load classes and calculate stats
    db.collection('classes')
        .where('coachId', '==', coachId)
        .orderBy('classDate', 'desc')
        .get()
        .then((querySnapshot) => {
            let totalClasses = 0;
            let totalAmount = 0;
            const individualClasses = [];
            const groupClasses = [];
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                classData.id = doc.id;
                totalClasses++;
                totalAmount += parseFloat(classData.classFee) || 0;
                
                if (classData.classType === 'individual') {
                    individualClasses.push(classData);
                } else {
                    groupClasses.push(classData);
                }
            });
            
            // Update stats
            document.getElementById('totalClasses').textContent = totalClasses;
            document.getElementById('totalAmount').textContent = `₹${totalAmount.toFixed(2)}`;
            
            // Populate class tables
            populateClassTable('individualClassesTable', individualClasses);
            populateClassTable('groupClassesTable', groupClasses);
        })
        .catch((error) => {
            console.error('Error loading classes:', error);
        });
}

function populateClassTable(tableId, classes) {
    const tableBody = document.getElementById(tableId);
    tableBody.innerHTML = '';
    
    if (classes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No classes found</td></tr>';
        return;
    }
    
    classes.forEach((classItem) => {
        const row = document.createElement('tr');
        
        // Format date
        const classDate = new Date(classItem.classDate.seconds * 1000);
        const formattedDate = classDate.toLocaleDateString('en-IN');
        
        if (classItem.classType === 'individual') {
            // Get student name for individual classes
            let studentName = 'Unknown Student';
            if (classItem.studentId) {
                db.collection('students').doc(classItem.studentId).get()
                    .then((studentDoc) => {
                        if (studentDoc.exists) {
                            studentName = studentDoc.data().name;
                            row.cells[1].textContent = studentName;
                        }
                    });
            }
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${studentName}</td>
                <td>${classItem.duration} mins</td>
                <td>₹${classItem.classFee}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteClass('${classItem.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        } else {
            // Group class
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>Group Session</td>
                <td>${classItem.duration} mins</td>
                <td>₹${classItem.classFee}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteClass('${classItem.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        }
        
        tableBody.appendChild(row);
    });
}

function toggleStudentSelect() {
    const classType = document.getElementById('classType').value;
    const studentSelectContainer = document.getElementById('studentSelectContainer');
    
    if (classType === 'individual') {
        studentSelectContainer.style.display = 'block';
        document.getElementById('studentSelect').required = true;
    } else {
        studentSelectContainer.style.display = 'none';
        document.getElementById('studentSelect').required = false;
    }
}

function saveClass() {
    const user = JSON.parse(localStorage.getItem('user'));
    const classType = document.getElementById('classType').value;
    const classDate = document.getElementById('classDate').value;
    const duration = document.getElementById('duration').value;
    const classFee = document.getElementById('classFee').value;
    const notes = document.getElementById('notes').value;
    
    if (!classType || !classDate || !duration || !classFee) {
        alert('Please fill all required fields');
        return;
    }
    
    const classData = {
        coachId: user.uid,
        classType: classType,
        classDate: new Date(classDate),
        duration: parseInt(duration),
        classFee: parseFloat(classFee),
        notes: notes,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Add student ID for individual classes
    if (classType === 'individual') {
        const studentId = document.getElementById('studentSelect').value;
        if (!studentId) {
            alert('Please select a student for individual class');
            return;
        }
        classData.studentId = studentId;
    }
    
    // Save to Firestore
    db.collection('classes').add(classData)
        .then(() => {
            alert('Class added successfully!');
            document.getElementById('addClassForm').reset();
            document.getElementById('addClassModal').querySelector('.btn-close').click();
            loadCoachData(user.uid); // Refresh data
        })
        .catch((error) => {
            console.error('Error adding class:', error);
            alert('Error adding class: ' + error.message);
        });
}

function deleteClass(classId) {
    if (confirm('Are you sure you want to delete this class?')) {
        db.collection('classes').doc(classId).delete()
            .then(() => {
                const user = JSON.parse(localStorage.getItem('user'));
                loadCoachData(user.uid); // Refresh data
            })
            .catch((error) => {
                console.error('Error deleting class:', error);
                alert('Error deleting class: ' + error.message);
            });
    }
}

function showStudentsModal() {
    const user = JSON.parse(localStorage.getItem('user'));
    const tableBody = document.getElementById('studentsTableBody');
    tableBody.innerHTML = '';
    
    db.collection('assignments')
        .where('coachId', '==', user.uid)
        .where('status', '==', 'active')
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No students assigned</td></tr>';
            } else {
                querySnapshot.forEach((doc) => {
                    const assignment = doc.data();
                    
                    // Get student details
                    db.collection('students').doc(assignment.studentId).get()
                        .then((studentDoc) => {
                            if (studentDoc.exists) {
                                const student = studentDoc.data();
                                const row = document.createElement('tr');
                                
                                // Format assignment date
                                const assignedDate = new Date(assignment.assignedDate.seconds * 1000);
                                const formattedDate = assignedDate.toLocaleDateString('en-IN');
                                
                                row.innerHTML = `
                                    <td>${student.name}</td>
                                    <td>${student.email || 'N/A'}</td>
                                    <td>${student.phone || 'N/A'}</td>
                                    <td>${student.parentName || 'N/A'}</td>
                                    <td>${formattedDate}</td>
                                `;
                                
                                tableBody.appendChild(row);
                            }
                        });
                });
            }
            
            // Show modal
            new bootstrap.Modal(document.getElementById('studentsModal')).show();
        })
        .catch((error) => {
            console.error('Error loading students:', error);
            alert('Error loading students: ' + error.message);
        });
}