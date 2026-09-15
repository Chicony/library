let books = JSON.parse(localStorage.getItem('libraryBooks')) || [];

function saveBooks() {
    localStorage.setItem('libraryBooks', JSON.stringify(books));
}

function exportBooks() {
    const dataStr = JSON.stringify(books, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `library-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importBooks(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedBooks = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedBooks)) {
                alert('Неверный формат файла');
                return;
            }

            if (confirm(`Импортировать ${importedBooks.length} книг? Текущие данные будут заменены.`)) {
                books = importedBooks;
                saveBooks();
                renderBooks();
                alert('Импорт успешен!');
            }
        } catch (error) {
            alert('Ошибка при чтении файла');
            console.error(error);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function addBook() {
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const genre = document.getElementById('bookGenre').value;
    const status = document.getElementById('bookStatus').value;
    const rating = document.getElementById('bookRating').value;
    const date = document.getElementById('bookDate').value;

    if (!title || !author) {
        alert('Пожалуйста, заполните название и автора');
        return;
    }

    const book = {
        id: Date.now(),
        title,
        author,
        genre,
        status,
        rating: status === 'read' ? parseInt(rating) || null : null,
        date: status === 'read' ? date : null
    };

    books.push(book);
    saveBooks();
    renderBooks();

    document.getElementById('bookTitle').value = '';
    document.getElementById('bookAuthor').value = '';
    document.getElementById('bookGenre').value = '';
    document.getElementById('bookRating').value = '';
    document.getElementById('bookDate').value = '';
}

function deleteBook(id) {
    if (confirm('Удалить эту книгу?')) {
        books = books.filter(book => book.id !== id);
        saveBooks();
        renderBooks();
    }
}

function moveBook(id, newStatus) {
    const book = books.find(b => b.id === id);
    book.status = newStatus;
    
    if (newStatus === 'read') {
        document.getElementById('ratingRow').style.display = 'grid';
        const rating = prompt('Оцените книгу (1-5):');
        const date = prompt('Дата прочтения (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        
        if (rating && rating >= 1 && rating <= 5) {
            book.rating = parseInt(rating);
        }
        if (date) {
            book.date = date;
        }
    } else {
        book.rating = null;
        book.date = null;
    }
    
    saveBooks();
    renderBooks();
}

function renderBooks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const readBooks = books.filter(book => 
        book.status === 'read' && 
        (book.title.toLowerCase().includes(searchTerm) || 
        book.author.toLowerCase().includes(searchTerm))
    );
    
    const wantToReadBooks = books.filter(book => 
        book.status === 'want' && 
        (book.title.toLowerCase().includes(searchTerm) || 
        book.author.toLowerCase().includes(searchTerm))
    );

    document.getElementById('readCount').textContent = readBooks.length;
    document.getElementById('wantToReadCount').textContent = wantToReadBooks.length;

    document.getElementById('readBooks').innerHTML = readBooks.length > 0 
        ? readBooks.map(book => createBookCard(book, 'read')).join('')
        : '<div class="empty-state">Пока нет прочитанных книг</div>';

    document.getElementById('wantToReadBooks').innerHTML = wantToReadBooks.length > 0
        ? wantToReadBooks.map(book => createBookCard(book, 'want')).join('')
        : '<div class="empty-state">Список желаний пуст</div>';
}

function createBookCard(book, type) {
    const stars = book.rating ? '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating) : '';
    
    return `
        <div class="book-card">
            <div class="book-title">${book.title}</div>
            <div class="book-author">${book.author}</div>
            ${book.genre ? `<div class="book-genre">${book.genre}</div>` : ''}
            <div class="book-info">
                ${book.rating ? `<div class="book-rating">${stars}</div>` : ''}
                ${book.date ? `<div class="book-date">${book.date}</div>` : ''}
            </div>
            <div class="book-actions">
                ${type === 'want' 
                    ? `<button class="btn-small btn-move" onclick="moveBook(${book.id}, 'read')">Прочитано ✓</button>`
                    : `<button class="btn-small btn-move" onclick="moveBook(${book.id}, 'want')">В список желаний</button>`
                }
                <button class="btn-small btn-delete" onclick="deleteBook(${book.id})">Удалить</button>
            </div>
        </div>
    `;
}

document.getElementById('bookStatus').addEventListener('change', function() {
    document.getElementById('ratingRow').style.display = 
        this.value === 'read' ? 'grid' : 'none';
});

renderBooks();
