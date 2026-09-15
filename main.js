let books = [];
let gistId = null;
let githubToken = null;

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
    errorDiv.style.display = 'none';
    
    if (!token) {
        errorDiv.textContent = 'Введите токен';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 401) {
            throw new Error('Неверный токен. Проверьте что скопировали его полностью.');
        }
        if (response.status === 403) {
            throw new Error('Доступ запрещён. GitHub временно заблокировал запросы.');
        }
        if (!response.ok) {
            throw new Error('Ошибка GitHub: ' + response.status);
        }

        const user = await response.json();
        githubToken = token;
        localStorage.setItem('githubToken', token);
        
        showMainScreen(user.login);
        await loadBooks();
    } catch (error) {
        errorDiv.textContent = '❌ ' + error.message;
        errorDiv.style.display = 'block';
        console.error('Login error:', error);
    }
}

function logout() {
    localStorage.removeItem('githubToken');
    location.reload();
}

function showMainScreen(username) {
    document.getElementById('userName').textContent = username;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

async function initApp() {
    try {
        const userResponse = await fetch('https://api.github.com/user', {
            headers: { 
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!userResponse.ok) {
            throw new Error('Токен недействителен');
        }

        const user = await userResponse.json();
        showMainScreen(user.login);
        await loadBooks();
    } catch (error) {
        console.error('Init error:', error);
        localStorage.removeItem('githubToken');
        location.reload();
    }
}

async function loadBooks() {
    try {
        const response = await fetch('https://api.github.com/gists', {
            headers: { 
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 403) {
            alert('У токена нет доступа к Gist. Пересоздайте токен с scope "gist".');
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error('Ошибка загрузки: ' + response.status);
        }

        const gists = await response.json();
        const libraryGist = gists.find(g => g.files && g.files['library.json']);
        
        if (libraryGist) {
            gistId = libraryGist.id;
            const content = libraryGist.files['library.json'].content;
            
            // Проверка на пустой или невалидный контент
            if (!content || content.trim() === '') {
                books = [];
            } else {
                try {
                    books = JSON.parse(content);
                    if (!Array.isArray(books)) {
                        books = [];
                    }
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    books = [];
                }
            }
        } else {
            books = [];
        }
        
        renderBooks();
    } catch (error) {
        console.error('Load error:', error);
        books = [];
        renderBooks();
    }
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

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.status === 404) {
            gistId = null;
            return await saveToGist();
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || response.status);
        }

        const result = await response.json();
        gistId = result.id;
    } catch (error) {
        console.error('Save error:', error);
        alert('Ошибка сохранения: ' + error.message);
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

    books.push({
        id: Date.now(),
        title, author, genre, status,
        rating: status === 'read' ? (parseInt(rating) || null) : null,
        date: status === 'read' ? date : null
    });

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
        books = books.filter(b => b.id !== id);
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
        if (rating && rating >= 1 && rating <= 5) book.rating = parseInt(rating);
        if (date) book.date = date;
    } else {
        book.rating = null;
        book.date = null;
    }
    
    await saveToGist();
    renderBooks();
}

function renderBooks() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    
    const readBooks = books.filter(b => b.status === 'read' && 
        (b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)));
    const wantBooks = books.filter(b => b.status === 'want' && 
        (b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)));

    document.getElementById('readCount').textContent = readBooks.length;
    document.getElementById('wantToReadCount').textContent = wantBooks.length;

    document.getElementById('readBooks').innerHTML = readBooks.length 
        ? readBooks.map(b => card(b, 'read')).join('')
        : '<div class="empty-state">Пока нет прочитанных книг</div>';

    document.getElementById('wantToReadBooks').innerHTML = wantBooks.length
        ? wantBooks.map(b => card(b, 'want')).join('')
        : '<div class="empty-state">Список желаний пуст</div>';
}

function card(b, type) {
    const stars = b.rating ? '★'.repeat(b.rating) + '☆'.repeat(5 - b.rating) : '';
    return `<div class="book-card">
        <div class="book-title">${b.title}</div>
        <div class="book-author">${b.author}</div>
        ${b.genre ? `<div class="book-genre">${b.genre}</div>` : ''}
        <div class="book-info">
            ${b.rating ? `<div class="book-rating">${stars}</div>` : ''}
            ${b.date ? `<div class="book-date">${b.date}</div>` : ''}
        </div>
        <div class="book-actions">
            ${type === 'want' 
                ? `<button class="btn-small btn-move" onclick="moveBook(${b.id},'read')">Прочитано ✓</button>`
                : `<button class="btn-small btn-move" onclick="moveBook(${b.id},'want')">В список желаний</button>`}
            <button class="btn-small btn-delete" onclick="deleteBook(${b.id})">Удалить</button>
        </div>
    </div>`;
}

document.getElementById('bookStatus').addEventListener('change', function() {
    document.getElementById('ratingRow').style.display = 
        this.value === 'read' ? 'grid' : 'none';
});