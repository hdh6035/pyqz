let quizzes = [];
let users = {};
let currentUser = null;
let currentQuestionIndex = -1;
let remainingQuestions = [];
let isAdminAuthenticated = false;

// Firebase 초기화 함수
async function initializeFirebase() {
  console.log('Firebase 초기화 시작');
  try {
    if (!window.firebase) {
      throw new Error('Firebase SDK가 로드되지 않았습니다.');
    }

    const firebaseConfig = {
      apiKey: "AIzaSyC_x2mrgYdkYLOu5OOkNsEskTFRnC8urfM",
      authDomain: "pyqz-80d0a.firebaseapp.com",
      databaseURL: "https://pyqz-80d0a-default-rtdb.firebaseio.com",
      projectId: "pyqz-80d0a",
      storageBucket: "pyqz-80d0a.firebasestorage.app",
      messagingSenderId: "54702389083",
      appId: "1:54702389083:web:9d9cf2ef71bfcface58c7e",
      measurementId: "G-SBQS5WB6GF"
    };

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }

    console.log('Firebase 초기화 완료');
    return window.firebase.database();
  } catch (error) {
    console.error('Firebase 초기화 오류:', error);
    throw error;
  }
}

// Firebase 데이터베이스 참조
let database = null;
let quizzesRef;
let usersRef;
let historyRef;
let adminRef;

// Firebase 데이터 초기화 함수
async function initializeFirebaseData() {
  console.log('Firebase 데이터 초기화 시작');
  try {
    const [quizzesSnapshot, usersSnapshot, adminSnapshot] = await Promise.all([
      quizzesRef.once('value'),
      usersRef.once('value'),
      adminRef.once('value'),
    ]);

    console.log('퀴즈 데이터 로드 완료');
    const quizzesData = quizzesSnapshot.val();
    quizzes = Array.isArray(quizzesData)
      ? quizzesData.filter(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.question === 'string' &&
            typeof item.answer === 'string'
        )
      : [];
    if (currentUser) {
      remainingQuestions = quizzes.map((q) => ({ ...q }));
      saveToLocalStorage('remainingQuestions', remainingQuestions);
    }

    console.log('사용자 데이터 로드 완료');
    users = usersSnapshot.val() || {};
    Object.keys(users).forEach((userId) => {
      if (!users[userId].quizHistory) {
        users[userId].quizHistory = [];
      }
    });

    console.log('관리자 데이터 로드 완료');
    const adminData = adminSnapshot.val();
    if (!adminData) {
      await adminRef.set({
        password: 'admin123',
        lastModified: new Date().toISOString(),
      });
    }

    // 히스토리는 현재 사용자만 로드
    if (currentUser) {
      console.log(`사용자 ${currentUser} 히스토리 로드 시작`);
      await loadUserHistory(currentUser);
      console.log(`사용자 ${currentUser} 히스토리 로드 완료`);
    }

    console.log('Firebase 데이터 초기화 완료');
  } catch (error) {
    console.error('데이터 초기화 오류:', error);
    alert('데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}

// 사용자별 히스토리 로드 함수
async function loadUserHistory(userId) {
  console.log(`사용자 ${userId} 히스토리 로드 시도`);
  try {
    const snapshot = await historyRef.child(userId).once('value');
    const userHistory = snapshot.val() || {};
    users[userId].quizHistory = Object.values(userHistory).filter(
      (history) => history.question && history.userAnswer
    );
    saveToLocalStorage('users', users);
    console.log(`사용자 ${userId} 히스토리 로드 성공`);
  } catch (error) {
    console.error(`사용자 ${userId} 히스토리 로드 오류:`, error);
    users[userId].quizHistory = [];
  }
}

// Firebase 설정 함수
async function setupFirebase() {
  console.log('Firebase 설정 시작');
  try {
    database = await initializeFirebase();
    quizzesRef = database.ref('quizzes');
    usersRef = database.ref('users');
    historyRef = database.ref('history');
    adminRef = database.ref('admin');
    await initializeFirebaseData();
    console.log('Firebase 설정 완료');
  } catch (error) {
    console.error('Firebase 설정 오류:', error);
    alert('Firebase 초기화 중 오류가 발생했습니다.');
  }
}

// DOM 로드 후 Firebase 설정
window.addEventListener('load', setupFirebase);

// 데이터 저장 함수
async function saveToFirebase(key, data) {
  console.log(`Firebase에 ${key} 데이터 저장 시도`);
  try {
    const ref = { quizzes: quizzesRef, users: usersRef, history: historyRef }[key];
    if (ref) {
      await ref.set(data);
      console.log(`Firebase에 ${key} 데이터 저장 성공`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`${key} 저장 오류:`, error);
    return false;
  }
}

function saveToLocalStorage(key, data) {
  console.log(`localStorage에 ${key} 데이터 저장 시도`);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`localStorage에 ${key} 데이터 저장 성공`);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('localStorage 저장 실패:', e);
    return false;
  }
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach((section) => {
    section.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');
  if (sectionId === 'home') {
    document.getElementById('loginUserId').value = '';
    document.getElementById('loginUserPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
  } else if (sectionId === 'register') {
    document.getElementById('registerUserName').value = '';
    document.getElementById('registerUserId').value = '';
    document.getElementById('registerUserPassword').value = '';
    document.getElementById('registerResult').style.display = 'none';
  } else if (sectionId === 'adminLogin') {
    document.getElementById('adminPassword').value = '';
  }
}

function registerUser() {
  console.log('회원가입 시도');
  const userName = document.getElementById('registerUserName').value.trim();
  const userId = document.getElementById('registerUserId').value.trim();
  const password = document.getElementById('registerUserPassword').value.trim();

  if (!userName || userName.length < 2 || userName.length > 50) {
    document.getElementById('registerResult').textContent = '이름은 2~50자 사이로 입력하세요.';
    document.getElementById('registerResult').style.color = '#dc3545';
    document.getElementById('registerResult').style.display = 'block';
    return;
  }
  if (!userId || !/^[a-zA-Z0-9]+$/.test(userId) || userId.length < 4) {
    document.getElementById('registerResult').textContent = '아이디는 4자 이상의 영숫자로 입력하세요.';
    document.getElementById('registerResult').style.color = '#dc3545';
    document.getElementById('registerResult').style.display = 'block';
    return;
  }
  if (!password || password.length < 6) {
    document.getElementById('registerResult').textContent = '비밀번호는 6자 이상으로 입력하세요.';
    document.getElementById('registerResult').style.color = '#dc3545';
    document.getElementById('registerResult').style.display = 'block';
    return;
  }

  if (users[userId]) {
    document.getElementById('registerResult').textContent = '이미 존재하는 아이디입니다.';
    document.getElementById('registerResult').style.color = '#dc3545';
    document.getElementById('registerResult').style.display = 'block';
    return;
  }

  users[userId] = { name: userName, password, score: 0, quizHistory: [], joinDate: new Date().toISOString() };
  if (!saveToLocalStorage('users', users) || !saveToFirebase('users', users)) {
    document.getElementById('registerResult').textContent = '데이터 저장에 실패했습니다.';
    document.getElementById('registerResult').style.color = '#dc3545';
    document.getElementById('registerResult').style.display = 'block';
    return;
  }

  document.getElementById('registerResult').textContent = '회원가입이 완료되었습니다!';
  document.getElementById('registerResult').style.color = '#28a745';
  document.getElementById('registerResult').style.display = 'block';
  console.log('회원가입 완료:', userId);
}

async function loginUser() {
  console.log('로그인 시도');
  const username = document.getElementById('loginUserId').value;
  const password = document.getElementById('loginUserPassword').value;

  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요.');
    return;
  }

  try {
    const snapshot = await usersRef.once('value');
    const userData = snapshot.val();
    if (!userData || !userData[username]) {
      alert('등록되지 않은 사용자입니다. 회원가입을 먼저 해주세요.');
      return;
    }

    const user = userData[username];
    if (user.password !== password) {
      alert('비밀번호가 틀렸습니다.');
      return;
    }

    currentUser = username;
    saveToLocalStorage('currentUser', currentUser);

    await loadUserHistory(username);
    users[currentUser].quizHistory = users[currentUser].quizHistory || [];
    saveToLocalStorage('users', users);

    const userHistory = users[username]?.quizHistory || [];
    const correctQuestions = userHistory.filter((h) => h.isCorrect).map((h) => h.question);
    remainingQuestions = quizzes
      .filter((q) => !correctQuestions.includes(q.question))
      .map((q) => ({ ...q }));
    saveToLocalStorage('remainingQuestions', remainingQuestions);

    showSection('quizMode');
    nextQuestion();

    const userHistoryDisplay = document.getElementById('userHistoryDisplay');
    const userHistoryList = document.getElementById('userHistoryList');
    if (userHistoryDisplay && userHistoryList) {
      userHistoryDisplay.style.display = 'block';
      userHistoryList.innerHTML = userHistory
        .map((history) => {
          const date = history.timestamp ? new Date(history.timestamp) : new Date();
          const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Seoul',
          };
          const formattedDate = date.toLocaleString('ko-KR', options);
          // 정답/오답 표시 추가
          const correctClass = history.isCorrect ? 'correct' : 'incorrect';
          const correctText = history.isCorrect ? '정답' : '오답';
          return `
            <div class="user-history-item">
              <div class="user-history-question">문제: ${history.question}</div>
              <div class="user-history-user-answer">내 답: ${history.userAnswer}</div>
              <div class="user-history-result ${correctClass}">결과: ${correctText}</div>
              <div class="user-history-date">날짜: ${formattedDate}</div>
            </div>
          `;
        })
        .join('');
    }
    console.log('로그인 완료:', username);
  } catch (error) {
    console.error('로그인 오류:', error);
    alert('로그인 중 오류가 발생했습니다.');
  }
}

function loginAdmin() {
  console.log('관리자 로그인 시도');
  const password = document.getElementById('adminPassword').value;

  if (!password) {
    alert('비밀번호를 입력하세요.');
    return;
  }

  adminRef.once('value').then((snapshot) => {
    const adminData = snapshot.val();
    if (adminData && adminData.password === password) {
      isAdminAuthenticated = true;
      showSection('adminMode');
      displayAdminQuizzes();
      displayUserList();
      displayHistoryList();
      console.log('관리자 로그인 성공');
    } else {
      alert('잘못된 비밀번호입니다.');
      console.log('관리자 로그인 실패: 잘못된 비밀번호');
    }
  }).catch((error) => {
    console.error('관리자 인증 오류:', error);
    alert('서버 오류가 발생했습니다.');
  });
}

function changeAdminPassword() {
  console.log('관리자 비밀번호 변경 시도');
  if (!isAdminAuthenticated) {
    alert('먼저 관리자로 로그인하세요.');
    return;
  }

  const currentPassword = prompt('현재 관리자 비밀번호를 입력하세요:');
  if (!currentPassword) return;

  adminRef.once('value').then((snapshot) => {
    const adminData = snapshot.val();
    if (adminData && adminData.password === currentPassword) {
      const newPassword = prompt('새로운 비밀번호를 입력하세요 (최소 8자):');
      if (newPassword && newPassword.length >= 8) {
        adminRef.set({
          password: newPassword,
          lastModified: new Date().toISOString(),
        }).then(() => {
          alert('관리자 비밀번호가 성공적으로 변경되었습니다!');
          isAdminAuthenticated = false;
          showSection('adminLogin');
          console.log('관리자 비밀번호 변경 성공');
        }).catch((error) => {
          console.error('비밀번호 변경 오류:', error);
          alert('비밀번호 변경 중 오류가 발생했습니다.');
        });
      } else {
        alert('새 비밀번호는 최소 8자 이상이어야 합니다.');
      }
    } else {
      alert('현재 비밀번호가 일치하지 않습니다.');
      console.log('관리자 비밀번호 변경 실패: 잘못된 현재 비밀번호');
    }
  });
}

function toggleOptions() {
  const quizType = document.getElementById('quizType').value;
  document.getElementById('options').style.display = quizType === 'objective' ? 'block' : 'none';
}

function addQuiz() {
  console.log('퀴즈 추가 시도');
  const question = document.getElementById('quizQuestion').value.trim();
  const answer = document.getElementById('quizAnswer').value.trim();
  const type = document.getElementById('quizType').value;

  if (!question || question.length > 500) {
    alert('문제는 500자 이내로 입력하세요.');
    return;
  }
  if (!answer || answer.length > 100) {
    alert('정답은 100자 이내로 입력하세요.');
    return;
  }
  if (quizzes.some((q) => q.question === question)) {
    alert('이미 존재하는 문제입니다.');
    return;
  }

  let quiz = { question, answer, type };

  if (type === 'objective') {
    const optionA = document.getElementById('optionA').value.trim();
    const optionB = document.getElementById('optionB').value.trim();
    const optionC = document.getElementById('optionC').value.trim();
    const optionD = document.getElementById('optionD').value.trim();
    const options = [optionA, optionB, optionC, optionD];

    if (!optionA || !optionB || !optionC || !optionD || options.some((opt) => opt.length > 100)) {
      alert('객관식 보기를 모두 입력하고, 각 항목은 100자 이내로 작성하세요.');
      return;
    }
    if (!options.includes(answer)) {
      alert('정답이 보기에 포함되어야 합니다.');
      return;
    }
    quiz.options = options;
  }

  quizzes.push(quiz);
  if (!saveToFirebase('quizzes', quizzes)) {
    alert('문제 저장에 실패했습니다. 다시 시도해 주세요.');
    return;
  }

  document.getElementById('quizQuestion').value = '';
  document.getElementById('quizAnswer').value = '';
  document.getElementById('optionA').value = '';
  document.getElementById('optionB').value = '';
  document.getElementById('optionC').value = '';
  document.getElementById('optionD').value = '';
  document.getElementById('quizType').value = 'subjective';
  toggleOptions();
  displayAdminQuizzes();
  console.log('퀴즈 추가 완료');
}

function displayAdminQuizzes() {
  console.log('관리자 퀴즈 목록 표시');
  const quizList = document.getElementById('adminQuizList');
  quizList.innerHTML = '';

  quizzes.forEach((quiz, index) => {
    const div = document.createElement('div');
    div.className = 'quiz-item';
    let formattedQuestion = quiz.question.replace(/\n/g, '<br>');
    let html = `<div class="quiz-content">
      <h4>문제 ${index + 1}</h4>
      <p><strong>문제:</strong> ${formattedQuestion}</p>
      <p><strong>정답:</strong> ${quiz.answer}</p>
      <p><strong>유형:</strong> ${quiz.type}</p>
    </div>`;

    if (quiz.type === 'objective' && quiz.options) {
      html += '<div class="options">';
      html += quiz.options.map((opt, i) => `<p>${String.fromCharCode(97 + i)}. ${opt.replace(/\n/g, '<br>')}</p>`).join('');
      html += '</div>';
    }

    html += `<button onclick="deleteQuiz(${index})" class="delete-btn">삭제</button>`;
    div.innerHTML = html;
    quizList.appendChild(div);
  });
}

function resetUserHistory(userId) {
  console.log(`사용자 ${userId} 히스토리 초기화 시도`);
  if (users[userId]) {
    historyRef.child(userId).remove();
    users[userId].quizHistory = [];
    users[userId].score = 0;

    usersRef.child(userId).update({
      quizHistory: [],
      score: 0,
    });

    if (!saveToLocalStorage('users', users)) {
      alert('사용자 기록 초기화에 실패했습니다.');
    }

    displayUserList();
    alert('사용자 기록이 초기화되었습니다.');
    console.log(`사용자 ${userId} 히스토리 초기화 완료`);
  }
}

function deleteUser(userId) {
  console.log(`사용자 ${userId} 삭제 시도`);
  if (!isAdminAuthenticated) {
    alert('관리자 권한이 필요합니다.');
    return;
  }

  if (confirm(`정말로 ${users[userId].name} (${userId})님의 계정을 삭제하시겠습니까?`)) {
    usersRef.child(userId).remove();
    historyRef.child(userId).remove();
    delete users[userId];
    saveToFirebase('users', users);
    displayUserList();
    alert('계정이 성공적으로 삭제되었습니다.');
    console.log(`사용자 ${userId} 삭제 완료`);
  }
}

function displayUserList() {
  console.log('사용자 목록 표시');
  const userList = document.getElementById('userList');
  userList.innerHTML = '';

  if (Object.keys(users).length === 0) {
    userList.innerHTML = '<p>등록된 사용자가 없습니다.</p>';
    return;
  }

  for (const userId in users) {
    const user = users[userId];
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    const joinDate = new Date(user.joinDate || Date.now()).toLocaleDateString();
    userDiv.dataset.historyVisible = 'false';
    userDiv.innerHTML = `
      <div class="user-info">
        <h3>${user.name} (${userId})</h3>
        <p><strong>가입일:</strong> ${joinDate}</p>
        <p><strong>점수:</strong> ${user.score || 0}</p>
        <div class="user-actions">
          <button onclick="resetUserHistory('${userId}')" class="action-btn reset-btn">기록 초기화</button>
          <button onclick="deleteUser('${userId}')" class="action-btn delete-btn">회원 삭제</button>
          <button onclick="toggleUserHistory(this, '${userId}')" class="action-btn history-btn">풀이 기록</button>
        </div>
      </div>
      <div class="history-content" style="display: none;">
        <h4>풀이 기록</h4>
        <div class="history-items">
          ${user.quizHistory
            ? user.quizHistory
                .map((h) => {
                  const score = h.score || 0;
                  const timestamp = h.timestamp ? new Date(h.timestamp).toLocaleString() : '날짜 정보 없음';
                  const answer = h.answer || '정답 정보 없음';
                  const correctClass = h.isCorrect ? 'correct' : 'incorrect';
                  const correctText = h.isCorrect ? '정답' : '오답';
                  const answerDisplay = `<p><strong>답변:</strong> ${h.userAnswer || '답변 정보 없음'}</p>${
                    !h.isCorrect ? `<p><strong>정답:</strong> ${answer}</p>` : ''
                  }`;
                  return `<div class="history-item">
                    <p><strong>문제:</strong> ${h.question || '문제 정보 없음'}</p>
                    ${answerDisplay}
                    <p><strong>점수:</strong> ${score}점</p>
                    <p><strong>일시:</strong> ${timestamp}</p>
                    <p class="${correctClass}">${correctText}</p>
                  </div>`;
                })
                .join('')
            : '<p>풀이 기록이 없습니다.</p>'}
        </div>
      </div>
    `;
    userList.appendChild(userDiv);
  }
}

function toggleUserHistory(button, userId) {
  console.log(`사용자 ${userId} 히스토리 토글 시도`);
  const userDiv = button.closest('.user-item');
  const historyContent = userDiv.querySelector('.history-content');
  const historyVisible = historyContent.style.display === 'none';

  historyContent.style.display = historyVisible ? 'block' : 'none';
  button.textContent = historyVisible ? '풀이 기록' : '히스토리 숨기기';

  if (!historyVisible) {
    loadUserHistory(userId);
  }
}

async function loadUserHistory(userId) {
  console.log(`사용자 ${userId} 히스토리 로드 시도`);
  try {
    const snapshot = await historyRef.child(userId).once('value');
    const userHistory = snapshot.val() || {};
    users[userId].quizHistory = Object.values(userHistory).filter(
      (history) => history.question && history.userAnswer
    );
    saveToLocalStorage('users', users);
    console.log(`사용자 ${userId} 히스토리 로드 성공`);
  } catch (error) {
    console.error(`사용자 ${userId} 히스토리 로드 오류:`, error);
    users[userId].quizHistory = [];
  }
}

async function displayHistoryList() {
  console.log('히스토리 목록 표시 시도');
  const historyList = document.getElementById('adminHistoryTab');
  if (!historyList) {
    console.error('historyList 엘리먼트를 찾을 수 없습니다.');
    return;
  }

  historyList.innerHTML = '<div class="history-list"></div>';
  const historyContent = historyList.querySelector('.history-list');

  try {
    const userIds = Object.keys(users);
    if (userIds.length === 0) {
      historyContent.innerHTML = '<p>등록된 사용자가 없습니다.</p>';
      console.log('등록된 사용자 없음');
      return;
    }

    const historyPromises = userIds.map(async (userId) => {
      console.log(`사용자 ${userId} 히스토리 로드 시도`);
      const snapshot = await historyRef.child(userId).once('value');
      return { userId, history: snapshot.val() || {} };
    });

    const historyDataArray = await Promise.all(historyPromises);
    const hasHistory = historyDataArray.some(({ history }) => Object.keys(history).length > 0);

    if (!hasHistory) {
      historyContent.innerHTML = '<p>풀이 기록이 없습니다.</p>';
      console.log('풀이 기록 없음');
      return;
    }

    historyDataArray.forEach(({ userId, history }) => {
      const user = users[userId];
      if (!user || Object.keys(history).length === 0) return;

      const userDiv = document.createElement('div');
      userDiv.className = 'user-item';
      userDiv.innerHTML = `
        <div class="user-info">
          <h3>${user.name} (${userId})의 풀이 기록</h3>
          <div class="history-items">
            ${Object.values(history)
              .map((h) => `
                <div class="history-item">
                  <p><strong>문제:</strong> ${h.question || '문제 정보 없음'}</p>
                  <p><strong>답변:</strong> ${h.userAnswer || '답변 정보 없음'}</p>
                  <p><strong>정답:</strong> ${h.answer || '정답 정보 없음'}</p>
                  <p><strong>점수:</strong> ${h.score || 0}점</p>
                  <p><strong>일시:</strong> ${h.timestamp ? new Date(h.timestamp).toLocaleString() : '날짜 정보 없음'}</p>
                  <p class="${h.isCorrect ? 'correct' : 'incorrect'}">${h.isCorrect ? '정답' : '오답'}</p>
                </div>
              `)
              .join('')}
          </div>
        </div>
      `;
      historyContent.appendChild(userDiv);
    });
    console.log('히스토리 목록 표시 완료');
  } catch (error) {
    console.error('히스토리 목록 로드 오류:', error);
    historyContent.innerHTML = '<p>히스토리 데이터를 불러오지 못했습니다.</p>';
  }
}

function deleteQuiz(index) {
  console.log(`퀴즈 ${index} 삭제 시도`);
  if (confirm('정말로 이 문제를 삭제하시겠습니까?')) {
    quizzes.splice(index, 1);
    saveToFirebase('quizzes', quizzes)
      .then(() => {
        displayAdminQuizzes();
        alert('문제가 성공적으로 삭제되었습니다.');
        console.log(`퀴즈 ${index} 삭제 완료`);
      })
      .catch((error) => {
        console.error('문제 삭제 오류:', error);
        alert('문제 삭제 중 오류가 발생했습니다.');
      });
  }
}

function nextQuestion() {
  // 문제 변수 선언
  let quiz;
  let randomIndex;
  let optionsHTML = '';

  // 남은 문제가 없으면 새로운 세션 시작
  if (remainingQuestions.length === 0) {
    // 기존 히스토리에서 오답 문제와 새로운 문제를 합침
    const userHistory = users[currentUser]?.quizHistory || [];
    
    // 모든 문제를 풀었는지 확인
    const allQuestionsAnswered = quizzes.every(q => userHistory.some(h => h.question === q.question));
    
    if (allQuestionsAnswered) {
      // 모든 문제를 풀었을 때만 오답 문제와 새로운 문제를 섞어서 보여줌
      const incorrectQuestions = userHistory
        .filter(h => !h.isCorrect)
        .map(h => h.question);
      
      remainingQuestions = quizzes.filter(q => 
        incorrectQuestions.includes(q.question) || 
        !userHistory.some(h => h.question === q.question)
      );
      
      // 남은 문제가 없으면 완료 메시지 표시
      if (remainingQuestions.length === 0) {
        const userScore = users[currentUser] ? users[currentUser].score : 0;
        document.getElementById('currentQuestion').textContent = `모든 문제를 풀었습니다! 당신의 점수: ${userScore}점`;
        document.getElementById('userAnswer').style.display = 'none';
        document.getElementById('submitButton').style.display = 'none';
        document.getElementById('nextButton').style.display = 'none';
        document.getElementById('endButton').style.display = 'inline-block';
        document.getElementById('quizResult').textContent = '';
        return;
      }
    } else {
      // 아직 모든 문제를 풀지 않았다면 남은 문제만 보여줌
      remainingQuestions = quizzes.filter(q => 
        !userHistory.some(h => h.question === q.question)
      );
    }
  }

  // 남은 문제가 있는 경우에만 문제를 선택하고 표시
  if (remainingQuestions.length > 0) {
    randomIndex = Math.floor(Math.random() * remainingQuestions.length);
    quiz = remainingQuestions[randomIndex];
    currentQuestionIndex = quizzes.findIndex(q => q.question === quiz.question);

    // 선택된 문제를 남은 문제 목록에서 제거
    remainingQuestions.splice(randomIndex, 1);

    // UI 초기화
    document.getElementById('quizResult').textContent = '';
    document.getElementById('userAnswer').value = '';
    document.getElementById('submitButton').style.display = 'inline-block';
    document.getElementById('nextButton').style.display = 'none';
    document.getElementById('endButton').style.display = 'none';

    // 문제 표시
    if (quiz.type === 'objective') {
      optionsHTML = `<p>${quiz.question.replace(/\n/g, '<br>')}</p>`;
      optionsHTML += '<div class="options-container">';
      
      // 옵션 문자열 HTML 엔티티 변환 함수
      function escapeHtml(str) {
        return str
          .replace(/&/g, '&')
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/"/g, '"')
          .replace(/'/g, '');
      }

      quiz.options.forEach((opt, idx) => {
        const safeVal = escapeHtml(opt);
        optionsHTML += `
          <label class="option-item">
            <input type="radio" name="option" value="${safeVal}">
            ${String.fromCharCode(97 + idx)}. ${opt.replace(/\n/g, ' ')}
          </label>`;
      });
      optionsHTML += '</div>';
      document.getElementById('currentQuestion').innerHTML = optionsHTML;
      document.getElementById('userAnswer').style.display = 'none';
    } else {
      document.getElementById('currentQuestion').innerHTML = `<p>${quiz.question.replace(/\n/g, '<br>')}</p>`;
      document.getElementById('userAnswer').style.display = 'inline-block';
    }

    // 라디오 버튼 초기화
    const radioButtons = document.querySelectorAll('input[name="option"]');
    radioButtons.forEach(radio => radio.checked = false);
    console.log('다음 퀴즈 로드 완료');
  } else {
    // 남은 문제가 없을 때 완료 메시지 표시
    const userScore = users[currentUser] ? users[currentUser].score : 0;
    document.getElementById('currentQuestion').textContent = `모든 문제를 풀었습니다! 당신의 점수: ${userScore}점`;
    document.getElementById('userAnswer').style.display = 'none';
    document.getElementById('submitButton').style.display = 'none';
    document.getElementById('nextButton').style.display = 'none';
    document.getElementById('endButton').style.display = 'inline-block';
    document.getElementById('quizResult').textContent = '';
    return;
  }
}

function submitAnswer() {
  console.log('답변 제출 시도');
  const quiz = quizzes[currentQuestionIndex];
  let userAnswer =
    quiz.type === 'subjective'
      ? document.getElementById('userAnswer').value.trim()
      : document.querySelector('input[name="option"]:checked')?.value;

  if (!userAnswer) {
    alert(quiz.type === 'subjective' ? '답변을 입력해주세요.' : '보기를 선택해주세요.');
    return;
  }

  const isCorrect =
    quiz.type === 'subjective' ? userAnswer.toLowerCase() === quiz.answer.toLowerCase() : userAnswer === quiz.answer;

  const score = isCorrect ? 1 : 0;
  if (users[currentUser]) {
    users[currentUser].score = (users[currentUser].score || 0) + score;

    const historyData = {
      question: quiz.question,
      userAnswer: userAnswer,
      answer: quiz.answer,
      isCorrect: isCorrect,
      score: score,
      timestamp: new Date().toISOString(),
    };

    const userHistoryRef = historyRef.child(currentUser);
    userHistoryRef.push(historyData).then(() => {
      users[currentUser].quizHistory = users[currentUser].quizHistory || [];
      users[currentUser].quizHistory.push(historyData);

      saveToLocalStorage('users', users);
      usersRef.child(currentUser).update({
        score: users[currentUser].score,
        quizHistory: users[currentUser].quizHistory,
      });

      // 문제를 풀었으니 남은 문제 목록에서 제거
      remainingQuestions = remainingQuestions.filter((q) => q.question !== quiz.question);

      document.getElementById('quizResult').textContent = isCorrect ? '정답입니다!' : '오답입니다.';
      document.getElementById('submitButton').style.display = 'none';
      document.getElementById('nextButton').style.display = 'inline-block';
      document.getElementById('endButton').style.display = 'inline-block';

      // 남은 문제가 없으면 퀴즈 종료
      if (remainingQuestions.length === 0) {
        const userScore = users[currentUser] ? users[currentUser].score : 0;
        document.getElementById('currentQuestion').textContent = `모든 문제를 풀었습니다! 당신의 점수: ${userScore}점`;
        document.getElementById('nextButton').style.display = 'none';
        document.getElementById('endButton').style.display = 'inline-block';
        return;
      }
      console.log('답변 제출 완료');
    }).catch((error) => {
      console.error('히스토리 저장 오류:', error);
      alert('풀이 기록 저장에 실패했습니다. 다시 시도해 주세요.');
    });
  }
}

function endQuiz() {
  console.log('퀴즈 종료');
  currentUser = null;
  showSection('home');
}

function logoutUser() {
  console.log('사용자 로그아웃');
  currentUser = null;
  showSection('home');
}

function logoutAdmin() {
  console.log('관리자 로그아웃');
  isAdminAuthenticated = false;
  showSection('home');
}

function showAdminTab(tabId) {
  console.log(`관리자 탭 ${tabId} 표시`);
  document.querySelectorAll('.admin-tabs button').forEach((btn) => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    }
  });

  document.querySelectorAll('.admin-content').forEach((content) => {
    content.classList.remove('active');
    if (content.id === `admin${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Tab`) {
      content.classList.add('active');
    }
  });
}
