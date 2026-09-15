let books = [];
let gistId = null;
let githubToken = null;

// Проверка токена при загрузке
window.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken) {
        githubToken = savedToken;
        initApp();
    }
});

async function login() {
    const token = document.getElementById('tokenInput').value.trim();
    const errorDiv = document.getElementById('errorMessage');
    
    if (!token) {
        errorDiv.textContent = 'Введите токен';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        // Проверка токена
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!response.ok) {
            throw new Error('Неверный токен');
        }

        const user = await response.json();
        githubToken = token;
        localStorage.setItem('githubToken', token);
        
        document.getElementById('userName').textContent = user.login;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        await initApp();
    } catch (error) {
        errorDiv.textContent = 'Ошибка: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('githubToken');
    location.reload();
}

async function initApp() {
    // Поиск существующего gist
    const response = await fetch('https://api.github.com/gists', {
        headers: { 'Authorization': `token ${githubToken}` }
    });
    const gists = await response.json();
    
    const libraryGist = gists.find(g => g.files['library.json']);
    
    if (libraryGist) {
        gistId = libraryGist.id;
        const content = libraryGist.files['library.json'].content;
        books = JSON.parse(content);
    } else {
        books = [];
    }
    
    renderBooks();
}

async function saveToGist() {
    const data = {
        description: 'Моя библиотека книг',
        public: false,
        files: {
            'library.json': {
                content: JSON.stringify(books, null, 2)
            }
        }
    };

    const url = gistId 
        ? `https://api.github.com/gists/${gistId}`
        : 'https://api.github.com/gists';
    
    const method = gistId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        alert('Ошибка сохранения');
    } else {
        const result = await response.json();
        gistId = result.id;
    }
}

async function addBook() {
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
    await saveToGist();
    renderBooks();

    document.getElementById('bookTitle').value = '';
    document.getElementById('bookAuthor').value = '';
    document.getElementById('bookGenre').value = '';
    document.getElementById('bookRating').value = '';
    document.getElementById('bookDate').value = '';
}

async function deleteBook(id) {
    if (confirm('Удалить эту книгу?')) {
        books = books.filter(book => book.id !== id);
        await saveToGist();
        renderBooks();
    }
}

async function moveBook(id, newStatus) {
    const book = books.find(b => b.id === id);
    book.status = newStatus;
    
    if (newStatus === 'read') {
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
    
    await saveToGist();
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