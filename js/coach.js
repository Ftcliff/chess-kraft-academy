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
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('classDate').value = today;
});

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

function loadCoachData(coachId) {
    console.log("Loading data for coach:", coachId);
    
    // Load assigned students
    db.collection('assignments')
        .where('coachId', '==', coachId)
        .where('status', '==', 'active')
        .get()
        .then((querySnapshot) => {
            const studentSelect = document.getElementById('studentSelect');
            studentSelect.innerHTML = '<option value="">Select Student</option>';
            
            const studentPromises = [];
            
            querySnapshot.forEach((doc) => {
                const assignment = doc.data();
                // Get student details
                const promise = db.collection('students').doc(assignment.studentId).get()
                    .then((studentDoc) => {
                        if (studentDoc.exists) {
                            const student = studentDoc.data();
                            const option = document.createElement('option');
                            option.value = studentDoc.id;
                            option.textContent = student.name;
                            studentSelect.appendChild(option);
                            return studentDoc.id;
                        }
                    });
                studentPromises.push(promise);
            });
            
            // Update student count
            document.getElementById('totalStudents').textContent = querySnapshot.size;
            
            return Promise.all(studentPromises);
        })
        .catch((error) => {
            console.error('Error loading students:', error);
            alert('Error loading students: ' + error.message);
        });
    
    // Load classes and calculate stats
    loadCoachClasses(coachId);
}

function loadCoachClasses(coachId) {
    console.log("Loading classes for coach:", coachId);
    
    db.collection('classes')
        .where('coachId', '==', coachId)
        .orderBy('classDate', 'desc')
        .get()
        .then((querySnapshot) => {
            console.log("Found classes:", querySnapshot.size);
            
            let totalClasses = 0;
            let totalAmount = 0;
            const individualClasses = [];
            const groupClasses = [];
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                classData.id = doc.id;
                console.log("Class data:", classData);
                
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
            alert('Error loading classes: ' + error.message);
        });
}

function populateClassTable(tableId, classes) {
    const tableBody = document.getElementById(tableId);
    tableBody.innerHTML = '';
    
    console.log(`Populating ${tableId} with ${classes.length} classes`);
    
    if (classes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No classes found</td></tr>';
        return;
    }
    
    // Sort classes by date (newest first)
    classes.sort((a, b) => {
        const dateA = a.classDate && a.classDate.seconds ? new Date(a.classDate.seconds * 1000) : new Date(a.classDate);
        const dateB = b.classDate && b.classDate.seconds ? new Date(b.classDate.seconds * 1000) : new Date(b.classDate);
        return dateB - dateA;
    });
    
    classes.forEach((classItem) => {
        const row = document.createElement('tr');
        
        // Format date
        let classDate;
        if (classItem.classDate && classItem.classDate.seconds) {
            classDate = new Date(classItem.classDate.seconds * 1000);
        } else {
            classDate = new Date(classItem.classDate);
        }
        const formattedDate = classDate.toLocaleDateString('en-IN');
        
        if (classItem.classType === 'individual') {
            // For individual classes, get student name
            let studentName = 'Unknown Student';
            
            if (classItem.studentId) {
                // Try to get student name
                db.collection('students').doc(classItem.studentId).get()
                    .then((studentDoc) => {
                        if (studentDoc.exists) {
                            studentName = studentDoc.data().name;
                            // Update the cell with student name
                            const studentCell = row.cells[1];
                            if (studentCell) {
                                studentCell.textContent = studentName;
                            }
                        }
                    })
                    .catch((error) => {
                        console.error('Error fetching student:', error);
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

function saveClass() {
    const user = JSON.parse(localStorage.getItem('user'));
    const classType = document.getElementById('classType').value;
    const classDate = document.getElementById('classDate').value;
    const duration = document.getElementById('duration').value;
    const classFee = document.getElementById('classFee').value;
    const notes = document.getElementById('notes').value;
    
    console.log("Saving class:", { classType, classDate, duration, classFee, notes });
    
    if (!classType || !classDate || !duration || !classFee) {
        alert('Please fill all required fields');
        return;
    }
    
    // Show loading state
    const saveBtn = document.getElementById('saveClassBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Saving...';
    
    const classData = {
        coachId: user.uid,
        classType: classType,
        classDate: new Date(classDate), // Store as JavaScript Date object
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
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Class';
            return;
        }
        classData.studentId = studentId;
    }
    
    // Save to Firestore
    db.collection('classes').add(classData)
        .then((docRef) => {
            console.log("Class saved with ID:", docRef.id);
            alert('Class added successfully!');
            document.getElementById('addClassForm').reset();
            
            // Reset to today's date
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('classDate').value = today;
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addClassModal'));
            modal.hide();
            
            // Refresh data
            loadCoachData(user.uid);
        })
        .catch((error) => {
            console.error('Error adding class:', error);
            alert('Error adding class: ' + error.message);
        })
        .finally(() => {
            // Reset button state
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Class';
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
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    
    db.collection('assignments')
        .where('coachId', '==', user.uid)
        .where('status', '==', 'active')
        .get()
        .then((querySnapshot) => {
            tableBody.innerHTML = '';
            
            if (querySnapshot.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No students assigned</td></tr>';
                return;
            }
            
            const studentPromises = [];
            
            querySnapshot.forEach((doc) => {
                const assignment = doc.data();
                
                // Get student details
                const promise = db.collection('students').doc(assignment.studentId).get()
                    .then((studentDoc) => {
                        if (studentDoc.exists) {
                            const student = studentDoc.data();
                            const row = document.createElement('tr');
                            
                            // Format assignment date
                            let assignedDate;
                            if (assignment.assignedDate && assignment.assignedDate.seconds) {
                                assignedDate = new Date(assignment.assignedDate.seconds * 1000);
                            } else {
                                assignedDate = new Date(assignment.assignedDate);
                            }
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
                
                studentPromises.push(promise);
            });
            
            return Promise.all(studentPromises);
        })
        .then(() => {
            // Show modal
            new bootstrap.Modal(document.getElementById('studentsModal')).show();
        })
        .catch((error) => {
            console.error('Error loading students:', error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading students</td></tr>';
        });
}
