let quizzes = [];
let users = {};
let currentUser = null;
let currentQuestionIndex = -1;
let remainingQuestions = []; // 아직 풀지 않은 문제
let quizHistory = [];

// Firebase 데이터베이스 참조
const quizzesRef = firebase.database().ref('quizzes');
const usersRef = firebase.database().ref('users');
const historyRef = firebase.database().ref('history');

// Firebase 데이터 초기화
function initializeFirebaseData() {
  // 퀴즈 데이터 가져오기
  quizzesRef.once('value').then(snapshot => {
    quizzes = snapshot.val() || [];
    if (currentUser) {
      loadUserHistory();
    }
  });

  // 사용자 데이터 가져오기
  usersRef.once('value').then(snapshot => {
    users = snapshot.val() || {};
  });

  // 퀴즈 풀이 기록 가져오기
  historyRef.once('value').then(snapshot => {
    quizHistory = snapshot.val() || [];
  });
}

// 데이터 저장 함수 (Firebase)
function saveToFirebase(key, data) {
  try {
    const ref = {
      'quizzes': quizzesRef,
      'users': usersRef,
      'history': historyRef
    }[key];
    if (ref) {
      ref.set(data);
      return true;
    }
  } catch (e) {
    console.error(`${key} 저장 오류:`, e);
    return false;
  }
  return false;
}

// 호환성을 위한 saveToLocalStorage 함수
function saveToLocalStorage(key, data) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {
    console.warn('localStorage 저장 실패:', e);
  }
  // Firebase에도 동시 저장
  saveToFirebase(key, data);
  return true;
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(section => {
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
    document.getElementById('registerResult').textContent = '';
    document.getElementById('registerResult').style.display = 'none';
  } else if (sectionId === 'adminLogin') {
    document.getElementById('adminPassword').value = '';
  }
}

function registerUser() {
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

  users[userId] = { name: userName, password, score: 0, quizHistory: [] };
  if (!saveToLocalStorage('users', users)) {
    document.getElementById('registerResult').textContent = '데이터 저장에 실패했습니다. 브라우저 저장공간을 확인해 주세요.';
    document.getElementById('registerResult').style.color = '#dc3545';
    document.getElementById('registerResult').style.display = 'block';
    return;
  }

  document.getElementById('registerResult').textContent = '회원가입이 완료되었습니다!';
  document.getElementById('registerResult').style.color = '#28a745';
  document.getElementById('registerResult').style.display = 'block';
}

function loginUser() {
  const userId = document.getElementById('loginUserId').value.trim();
  const password = document.getElementById('loginUserPassword').value.trim();
  const loginError = document.getElementById('loginError');

  loginError.style.display = 'none';
  loginError.textContent = '';

  if (!userId || !password) {
    loginError.textContent = '아이디와 비밀번호를 모두 입력하세요.';
    loginError.style.display = 'block';
    return;
  }

  if (!users[userId]) {
    loginError.textContent = '존재하지 않는 아이디입니다.';
    loginError.style.display = 'block';
    return;
  }

  if (users[userId].password !== password) {
    loginError.textContent = '비밀번호가 일치하지 않습니다.';
    loginError.style.display = 'block';
    return;
  }

  remainingQuestions = [...quizzes];
  currentUser = userId;
  if (quizzes.length === 0) {
    loginError.textContent = '문제가 없습니다. 관리자에게 문의하세요.';
    loginError.style.display = 'block';
    return;
  }
  nextQuestion();
  showSection('quizMode');
}

function loginAdmin() {
  const password = document.getElementById('adminPassword').value;
  if (password === 'admin123') {
    showSection('adminMode');
    displayAdminQuizzes();
    displayUserList();
  } else {
    alert('잘못된 비밀번호입니다.');
  }
}

function toggleOptions() {
  const quizType = document.getElementById('quizType').value;
  document.getElementById('options').style.display = quizType === 'objective' ? 'block' : 'none';
}

function addQuiz() {
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
  if (quizzes.some(q => q.question === question)) {
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

    if (!optionA || !optionB || !optionC || !optionD || options.some(opt => opt.length > 100)) {
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
}

function displayAdminQuizzes() {
  const quizList = document.getElementById('adminQuizList');
  quizList.innerHTML = '';
  quizzes.forEach((quiz, index) => {
    const div = document.createElement('div');
    div.className = 'quiz-item';
    let formattedQuestion = quiz.question.replace(/\n/g, '<br>');
    let html = `문제: ${formattedQuestion} (정답: ${quiz.answer}, 유형: ${quiz.type})`;

    if (quiz.type === 'objective' && quiz.options) {
      html += '<br>보기:<br>';
      html += quiz.options.map((opt, i) => `${String.fromCharCode(97 + i)}. ${opt.replace(/\n/g, '<br>')}`).join('<br>');
    }

    html += ` <button onclick="deleteQuiz(${index})">삭제</button>`;
    div.innerHTML = html;
    quizList.appendChild(div);
  });
}

function resetUserHistory(userId) {
  if (users[userId]) {
    users[userId].quizHistory = [];
    users[userId].score = 0;
    if (!saveToLocalStorage('users', users)) {
      alert('사용자 기록 초기화에 실패했습니다.');
    }
    displayUserList();
  }
}

function displayUserList() {
  const userList = document.getElementById('userList');
  userList.innerHTML = '';

  if (Object.keys(users).length === 0) {
    userList.innerHTML = '<p>등록된 사용자가 없습니다.</p>';
    return;
  }

  for (const userId in users) {
    const user = users[userId];
    const div = document.createElement('div');
    div.className = 'user-item';
    let historyHTML = '<div>퀴즈 기록:</div>';
    if (user.quizHistory && user.quizHistory.length > 0) {
      user.quizHistory.forEach(history => {
        let formattedQ = history.question.replace(/\n/g, '<br>');
        historyHTML += `
          <div class="history-item ${history.isCorrect ? 'correct' : 'incorrect'}">
            문제: ${formattedQ}, 답변: ${history.userAnswer} (${history.isCorrect ? '정답' : '오답'}), 일시: ${history.timestamp}
          </div>`;
      });
    } else {
      historyHTML += '<div>푼 퀴즈가 없습니다.</div>';
    }

    div.innerHTML = `
      <strong>이름:</strong> ${user.name}<br>
      <strong>아이디:</strong> ${userId}<br>
      <strong>점수:</strong> ${user.score}<br>
      ${historyHTML}
      <button onclick="resetUserHistory('${userId}')">기록 초기화</button>
    `;
    userList.appendChild(div);
  }
}

function deleteQuiz(index) {
  if (confirm('정말로 이 문제를 삭제하시겠습니까?')) {
    quizzes.splice(index, 1);
    if (!saveToLocalStorage('quizzes', quizzes)) {
      alert('문제 삭제에 실패했습니다.');
    }
    displayAdminQuizzes();
  }
}

function nextQuestion() {
  if (remainingQuestions.length === 0) {
    const userScore = users[currentUser]?.score || 0;
    document.getElementById('currentQuestion').textContent = `모든 문제를 풀었습니다! 당신의 점수: ${userScore}점`;
    document.getElementById('userAnswer').style.display = 'none';
    document.getElementById('submitButton').style.display = 'none';
    document.getElementById('nextButton').style.display = 'none';
    document.getElementById('endButton').style.display = 'inline-block';
    document.getElementById('quizResult').textContent = '';
    return;
  }

  const randomIndex = Math.floor(Math.random() * remainingQuestions.length);
  const quiz = remainingQuestions[randomIndex];
  currentQuestionIndex = quizzes.findIndex(q => q.question === quiz.question);

  document.getElementById('quizResult').textContent = '';
  document.getElementById('userAnswer').value = '';
  document.getElementById('submitButton').style.display = 'inline-block';
  document.getElementById('nextButton').style.display = 'none';
  document.getElementById('endButton').style.display = 'none';

  if (quiz.type === 'objective') {
    let optionsHTML = `<p>${quiz.question.replace(/\n/g, '<br>')}</p>`;
    optionsHTML += '<div class="options-container">';
    // 옵션 문자열 HTML 엔티티 변환 함수
    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    quiz.options.forEach((opt, idx) => {
      const safeVal = escapeHtml(opt);
      optionsHTML += `
        <div class="option-item">
          <input type="radio" name="option" id="option${idx}" value="${safeVal}">
          <label for="option${idx}">${String.fromCharCode(97 + idx)}. ${opt.replace(/\n/g, ' ')}</label>
        </div>`;
    });
    optionsHTML += '</div>';
    document.getElementById('currentQuestion').innerHTML = optionsHTML;
    document.getElementById('userAnswer').style.display = 'none';
  } else {
    document.getElementById('currentQuestion').innerHTML = `<p>${quiz.question.replace(/\n/g, '<br>')}</p>`;
    document.getElementById('userAnswer').style.display = 'inline-block';
  }

  const radioButtons = document.querySelectorAll('input[name="option"]');
  radioButtons.forEach(radio => radio.checked = false);
}

function submitAnswer() {
  const quiz = quizzes[currentQuestionIndex];
  let userAnswer = quiz.type === 'subjective' ? document.getElementById('userAnswer').value.trim() : document.querySelector('input[name="option"]:checked')?.value;
  if (!userAnswer) {
    alert(quiz.type === 'subjective' ? '답변을 입력해주세요.' : '보기를 선택해주세요.');
    return;
  }

  const isCorrect = userAnswer === quiz.answer;
  const now = new Date();
  const timestamp = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  // 기록 저장
  if (!Array.isArray(quizHistory)) {
    quizHistory = [];
  }
  quizHistory.push({
    question: quiz.question,
    userAnswer: userAnswer,
    correctAnswer: quiz.answer,
    timestamp: timestamp,
    isCorrect: isCorrect
  });
  saveToLocalStorage('history', quizHistory);

  // 사용자 기록 업데이트
  if (!users[currentUser]) {
    users[currentUser] = { name: currentUser, password: '', score: 0, quizHistory: [] };
  }
  if (!Array.isArray(users[currentUser].quizHistory)) {
    users[currentUser].quizHistory = [];
  }
  users[currentUser].quizHistory.push({ question: quiz.question, userAnswer, correctAnswer: quiz.answer, timestamp, isCorrect });
  if (isCorrect) users[currentUser].score += 10;
  saveToLocalStorage('users', users);

  // 결과 표시
  document.getElementById('quizResult').textContent = isCorrect ? '정답입니다!' : '오답입니다. 정답은 ' + quiz.answer + '입니다.';
  document.getElementById('quizResult').style.color = isCorrect ? '#28a745' : '#dc3545';
  document.getElementById('userAnswer').style.display = 'none';
  document.getElementById('submitButton').style.display = 'none';
  remainingQuestions = remainingQuestions.filter(q => q.question !== quiz.question);

  if (remainingQuestions.length > 0) {
    document.getElementById('nextButton').style.display = 'inline-block';
    document.getElementById('endButton').style.display = 'inline-block';
  } else {
    document.getElementById('nextButton').style.display = 'none';
    document.getElementById('endButton').style.display = 'inline-block';
  }
}

function endQuiz() {
  currentUser = null;
  showSection('home');
}

function logoutUser() {
  currentUser = null;
  showSection('home');
}

function logoutAdmin() {
  showSection('home');
}

function hash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// 페이지 로드 시 Firebase 초기화
window.addEventListener('load', () => {
  initializeFirebaseData();
});
