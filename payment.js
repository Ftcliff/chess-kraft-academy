// Payment management functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.uid || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    // Set default dates (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('startDate').valueAsDate = firstDay;
    document.getElementById('endDate').valueAsDate = lastDay;
    
    // Load coaches for filter
    loadCoaches();
    
    // Load initial payment data
    loadPaymentData();
});

function loadCoaches() {
    const coachSelect = document.getElementById('coachSelect');
    
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
            console.error('Error loading coaches:', error);
        });
}

function loadPaymentData() {
    const coachId = document.getElementById('coachSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const paymentStatus = document.getElementById('paymentStatus').value;
    
    console.log("Loading payment data with filters:", { coachId, startDate, endDate, paymentStatus });
    
    let query = db.collection('classes');
    
    // Apply coach filter
    if (coachId) {
        query = query.where('coachId', '==', coachId);
    }
    
    // Apply date filters and payment status will be filtered client-side
    query.get()
        .then((querySnapshot) => {
            console.log("Found classes:", querySnapshot.size);
            
            let pendingAmount = 0;
            let completedAmount = 0;
            let totalAmount = 0;
            const classes = [];
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                classData.id = doc.id;
                
                // Set default payment status if not exists
                if (!classData.paymentStatus) {
                    classData.paymentStatus = 'pending';
                }
                
                // Filter by date range
                let classDate;
                if (classData.classDate && classData.classDate.seconds) {
                    classDate = new Date(classData.classDate.seconds * 1000);
                } else {
                    classDate = new Date(classData.classDate);
                }
                
                const filterStartDate = startDate ? new Date(startDate) : new Date(0);
                const filterEndDate = endDate ? new Date(endDate) : new Date();
                filterEndDate.setHours(23, 59, 59, 999); // End of day
                
                // Skip if not in date range
                if (classDate < filterStartDate || classDate > filterEndDate) {
                    return;
                }
                
                // Filter by payment status
                if (paymentStatus && classData.paymentStatus !== paymentStatus) {
                    return;
                }
                
                classes.push(classData);
                
                const fee = parseFloat(classData.classFee) || 0;
                totalAmount += fee;
                
                if (classData.paymentStatus === 'pending') {
                    pendingAmount += fee;
                } else if (classData.paymentStatus === 'paid') {
                    completedAmount += fee;
                }
            });
            
            // Update summary cards
            document.getElementById('pendingAmount').textContent = `₹${pendingAmount.toFixed(2)}`;
            document.getElementById('completedAmount').textContent = `₹${completedAmount.toFixed(2)}`;
            document.getElementById('totalAmount').textContent = `₹${totalAmount.toFixed(2)}`;
            
            // Populate table
            populatePaymentTable(classes);
        })
        .catch((error) => {
            console.error('Error loading payment data:', error);
            alert('Error loading classes: ' + error.message);
        });
}

function populatePaymentTable(classes) {
    const tableBody = document.getElementById('paymentTableBody');
    tableBody.innerHTML = '';
    
    if (classes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted">
                    No classes found for the selected filters
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort classes by date (newest first)
    classes.sort((a, b) => {
        const dateA = a.classDate && a.classDate.seconds ? 
            new Date(a.classDate.seconds * 1000) : new Date(a.classDate);
        const dateB = b.classDate && b.classDate.seconds ? 
            new Date(b.classDate.seconds * 1000) : new Date(b.classDate);
        return dateB - dateA;
    });
    
    const classPromises = [];
    
    classes.forEach((classItem) => {
        const promise = new Promise((resolve) => {
            // Get coach name
            let coachName = 'Unknown Coach';
            const coachPromise = classItem.coachId ? 
                db.collection('users').doc(classItem.coachId).get() : 
                Promise.resolve({ exists: false });
            
            // Get student name for individual classes
            let studentName = classItem.classType === 'individual' ? 'Unknown Student' : 'Group Session';
            const studentPromise = (classItem.classType === 'individual' && classItem.studentId) ? 
                db.collection('students').doc(classItem.studentId).get() : 
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
                    if (classItem.classDate && classItem.classDate.seconds) {
                        classDate = new Date(classItem.classDate.seconds * 1000);
                    } else {
                        classDate = new Date(classItem.classDate);
                    }
                    const formattedDate = classDate.toLocaleDateString('en-IN');
                    
                    // Status badge
                    const statusBadge = classItem.paymentStatus === 'paid' ? 
                        '<span class="badge bg-success">Paid</span>' : 
                        '<span class="badge bg-warning">Pending</span>';
                    
                    // Payment action button
                    const paymentAction = classItem.paymentStatus === 'paid' ? 
                        '<button class="btn btn-sm btn-outline-warning" onclick="markAsPending(\'' + classItem.id + '\')">Mark Pending</button>' : 
                        '<button class="btn btn-sm btn-outline-success" onclick="markAsPaid(\'' + classItem.id + '\')">Mark Paid</button>';
                    
                    row.innerHTML = `
                        <td>${formattedDate}</td>
                        <td>${coachName}</td>
                        <td>${studentName}</td>
                        <td>${classItem.classType.charAt(0).toUpperCase() + classItem.classType.slice(1)}</td>
                        <td>${classItem.duration} mins</td>
                        <td>₹${classItem.classFee}</td>
                        <td>${statusBadge}</td>
                        <td>${paymentAction}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteClass('${classItem.id}')">
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
}

function markAsPaid(classId) {
    if (confirm('Mark this class as paid?')) {
        db.collection('classes').doc(classId).update({
            paymentStatus: 'paid',
            paymentDate: new Date()
        })
        .then(() => {
            alert('Class marked as paid!');
            loadPaymentData(); // Refresh data
        })
        .catch((error) => {
            console.error('Error updating payment status:', error);
            alert('Error: ' + error.message);
        });
    }
}

function markAsPending(classId) {
    if (confirm('Mark this class as pending?')) {
        db.collection('classes').doc(classId).update({
            paymentStatus: 'pending',
            paymentDate: null
        })
        .then(() => {
            alert('Class marked as pending!');
            loadPaymentData(); // Refresh data
        })
        .catch((error) => {
            console.error('Error updating payment status:', error);
            alert('Error: ' + error.message);
        });
    }
}

function deleteClass(classId) {
    if (confirm('Are you sure you want to delete this class?')) {
        db.collection('classes').doc(classId).delete()
            .then(() => {
                alert('Class deleted successfully!');
                loadPaymentData(); // Refresh data
            })
            .catch((error) => {
                console.error('Error deleting class:', error);
                alert('Error deleting class: ' + error.message);
            });
    }
}

// Bulk payment functions
function showBulkPaymentModal() {
    const selectedCoach = document.getElementById('coachSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!selectedCoach) {
        alert('Please select a coach first');
        return;
    }
    
    // Calculate pending amount for bulk payment
    let query = db.collection('classes')
        .where('coachId', '==', selectedCoach)
        .where('paymentStatus', '==', 'pending');
    
    query.get()
        .then((querySnapshot) => {
            let totalPending = 0;
            let classCount = 0;
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                
                // Filter by date range
                let classDate;
                if (classData.classDate && classData.classDate.seconds) {
                    classDate = new Date(classData.classDate.seconds * 1000);
                } else {
                    classDate = new Date(classData.classDate);
                }
                
                const filterStartDate = startDate ? new Date(startDate) : new Date(0);
                const filterEndDate = endDate ? new Date(endDate) : new Date();
                filterEndDate.setHours(23, 59, 59, 999);
                
                if (classDate >= filterStartDate && classDate <= filterEndDate) {
                    totalPending += parseFloat(classData.classFee) || 0;
                    classCount++;
                }
            });
            
            if (classCount === 0) {
                alert('No pending classes found for the selected filters');
                return;
            }
            
            document.getElementById('bulkPaymentDetails').innerHTML = `
                <p><strong>Coach:</strong> ${document.getElementById('coachSelect').selectedOptions[0].text}</p>
                <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
                <p><strong>Classes:</strong> ${classCount} classes</p>
                <p><strong>Total Amount:</strong> ₹${totalPending.toFixed(2)}</p>
            `;
            
            new bootstrap.Modal(document.getElementById('bulkPaymentModal')).show();
        })
        .catch((error) => {
            console.error('Error calculating bulk payment:', error);
            alert('Error: ' + error.message);
        });
}

function processBulkPayment() {
    const selectedCoach = document.getElementById('coachSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    let query = db.collection('classes')
        .where('coachId', '==', selectedCoach)
        .where('paymentStatus', '==', 'pending');
    
    query.get()
        .then((querySnapshot) => {
            const updatePromises = [];
            let updatedCount = 0;
            
            querySnapshot.forEach((doc) => {
                const classData = doc.data();
                
                // Filter by date range
                let classDate;
                if (classData.classDate && classData.classDate.seconds) {
                    classDate = new Date(classData.classDate.seconds * 1000);
                } else {
                    classDate = new Date(classData.classDate);
                }
                
                const filterStartDate = startDate ? new Date(startDate) : new Date(0);
                const filterEndDate = endDate ? new Date(endDate) : new Date();
                filterEndDate.setHours(23, 59, 59, 999);
                
                if (classDate >= filterStartDate && classDate <= filterEndDate) {
                    updatePromises.push(
                        doc.ref.update({
                            paymentStatus: 'paid',
                            paymentDate: new Date()
                        })
                    );
                    updatedCount++;
                }
            });
            
            return Promise.all(updatePromises).then(() => updatedCount);
        })
        .then((updatedCount) => {
            alert(`Successfully marked ${updatedCount} classes as paid!`);
            document.getElementById('bulkPaymentModal').querySelector('.btn-close').click();
            loadPaymentData(); // Refresh data
        })
        .catch((error) => {
            console.error('Error processing bulk payment:', error);
            alert('Error: ' + error.message);
        });
}