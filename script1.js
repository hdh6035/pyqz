let quizzes = [];
let users = {};
let currentUser = null;
let currentQuestionIndex = -1;
let remainingQuestions = []; // 아직 풀지 않은 문제
let quizHistory = [];

// Firebase 초기화 함수
async function initializeFirebase() {
  try {
    // Firebase SDK가 로드되었는지 확인
    if (!window.firebase) {
      throw new Error('Firebase SDK가 로드되지 않았습니다.');
    }

    // Firebase 초기화
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

    // Firebase 앱이 이미 초기화되어 있는지 확인
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }

    // Firebase 데이터베이스 참조
    const database = window.firebase.database();
    return database;
  } catch (error) {
    console.error('Firebase 초기화 오류:', error);
    throw error;
  }
}

// Firebase 데이터베이스 참조 변수
let database = null;
// Firebase 데이터베이스 참조
let quizzesRef;
let usersRef;
let historyRef;
let adminRef;

// Firebase 초기화 후 실행할 함수
async function setupFirebase() {
  try {
    database = await initializeFirebase();
    
    // Firebase 데이터베이스 참조
    const quizzesRef = database.ref('quizzes');
    const usersRef = database.ref('users');
    const historyRef = database.ref('history');
    const adminRef = database.ref('admin');

    // 관리자 인증 상태
    let isAdminAuthenticated = false;

    // Firebase 데이터 초기화
    function initializeFirebaseData() {
      // 퀴즈 데이터 불러오기
      quizzesRef.once('value').then(snapshot => {
        const data = snapshot.val();
        if (Array.isArray(data)) {
          quizzes = data.filter(item => 
            typeof item === 'object' && 
            item !== null && 
            typeof item.question === 'string' && 
            typeof item.answer === 'string'
          );
        } else {
          quizzes = [];
        }
        if (currentUser) {
          // 남은 문제 초기화
          remainingQuestions = quizzes.map(q => ({ ...q }));
          saveToLocalStorage('remainingQuestions', remainingQuestions);
        }
      });

      // 사용자 데이터 불러오기
      usersRef.once('value').then(snapshot => {
        users = snapshot.val() || {};
        Object.keys(users).forEach(userId => {
          if (!users[userId].quizHistory) {
            users[userId].quizHistory = [];
          }
        });
      });

      // 관리자 비밀번호 초기화
      adminRef.once('value').then(snapshot => {
        const adminData = snapshot.val();
        if (!adminData) {
          adminRef.set({
            password: 'admin123',
            lastModified: new Date().toISOString()
          });
        }
      });

      // 히스토리 데이터 불러오기
      historyRef.once('value').then(snapshot => {
        const historyData = snapshot.val() || {};
        Object.keys(historyData).forEach(key => {
          const history = historyData[key];
          if (history.userId && history.question && history.userAnswer) {
            if (!users[history.userId]) {
              users[history.userId] = {
                name: history.userId,
                score: 0,
                quizHistory: []
              };
            }
            users[history.userId].quizHistory.push(history);
          }
        });
      });
    }

    // Firebase 초기화 완료 후 데이터 로드
    initializeFirebaseData();

  } catch (error) {
    console.error('Firebase 설정 오류:', error);
  }
}

// DOM이 완전히 로드된 후 Firebase 설정 실행
window.addEventListener('load', setupFirebase);

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
  const username = document.getElementById('loginUserId').value;
  const password = document.getElementById('loginUserPassword').value;

  if (!username || !password) {
    alert('아이디와 비밀번호를 입력해주세요.');
    return;
  }

  // Firebase에서 사용자 정보 확인
  usersRef.once('value').then(snapshot => {
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

    // 로그인 성공
    currentUser = username;
    saveToLocalStorage('currentUser', currentUser);

    // 사용자 히스토리 초기화
    users[currentUser].quizHistory = users[currentUser].quizHistory || [];
    saveToLocalStorage('users', users);

    // 남은 문제 초기화 (정답 문제 제외)
    const userHistory = users[username]?.quizHistory || [];
    const correctQuestions = userHistory
      .filter(h => h.isCorrect)
      .map(h => h.question);
    
    remainingQuestions = quizzes.filter(q => 
      !correctQuestions.includes(q.question)
    ).map(q => ({ ...q }));
    saveToLocalStorage('remainingQuestions', remainingQuestions);

    showSection('quizMode');
    nextQuestion();
  }).catch(error => {
    console.error('로그인 오류:', error);
    alert('로그인 중 오류가 발생했습니다.');
  });
}

function loginAdmin() {
  const password = document.getElementById('adminPassword').value;
  
  if (!password) {
    alert('비밀번호를 입력하세요.');
    return;
  }

  // Firebase에서 관리자 비밀번호 확인
  adminRef.once('value').then(snapshot => {
    const adminData = snapshot.val();
    if (adminData && adminData.password === password) {
      isAdminAuthenticated = true;
      showSection('adminMode');
      displayAdminQuizzes();
      displayUserList();
    } else {
      alert('잘못된 비밀번호입니다.');
    }
  }).catch(error => {
    console.error('관리자 인증 오류:', error);
    alert('서버 오류가 발생했습니다.');
  });
}

// 관리자 비밀번호 변경 함수
function changeAdminPassword() {
  if (!isAdminAuthenticated) {
    alert('먼저 관리자로 로그인하세요.');
    return;
  }

  const currentPassword = prompt('현재 관리자 비밀번호를 입력하세요:');
  
  if (!currentPassword) return;

  adminRef.once('value').then(snapshot => {
    const adminData = snapshot.val();
    if (adminData && adminData.password === currentPassword) {
      const newPassword = prompt('새로운 비밀번호를 입력하세요 (최소 8자):');
      if (newPassword && newPassword.length >= 8) {
        adminRef.set({
          password: newPassword,
          lastModified: new Date().toISOString()
        }).then(() => {
          alert('관리자 비밀번호가 성공적으로 변경되었습니다!');
          isAdminAuthenticated = false;
          showSection('adminLogin');
        }).catch(error => {
          console.error('비밀번호 변경 오류:', error);
          alert('비밀번호 변경 중 오류가 발생했습니다.');
        });
      } else {
        alert('새 비밀번호는 최소 8자 이상이어야 합니다.');
      }
    } else {
      alert('현재 비밀번호가 일치하지 않습니다.');
    }
  });
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

  displayAdminQuizzes();
}

function displayAdminQuizzes() {
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

    // 삭제 버튼 추가
    html += `<button onclick="deleteQuiz(${index})" class="delete-btn">삭제</button>`;

    div.innerHTML = html;
    quizList.appendChild(div);
  });
}

function resetUserHistory(userId) {
  if (users[userId]) {
    // Firebase에서 히스토리 데이터 삭제
    historyRef.orderByChild('userId').equalTo(userId).once('value').then(snapshot => {
      snapshot.forEach(child => {
        child.ref.remove();
      });
    });

    // 로컬 데이터 초기화
    users[userId].quizHistory = [];
    users[userId].score = 0;
    
    // Firebase 업데이트
    usersRef.child(userId).update({
      quizHistory: [],
      score: 0
    });

    // 로컬 스토리지 저장
    if (!saveToLocalStorage('users', users)) {
      alert('사용자 기록 초기화에 실패했습니다.');
    }

    displayUserList();
    alert('사용자 기록이 초기화되었습니다.');
  }
}

function deleteUser(userId) {
  if (!isAdminAuthenticated) {
    alert('관리자 권한이 필요합니다.');
    return;
  }

  if (confirm(`정말로 ${users[userId].name} (${userId})님의 계정을 삭제하시겠습니까?`)) {
    // Firebase에서 사용자 데이터 삭제
    usersRef.child(userId).remove().then(() => {
      // 로컬 데이터에서도 삭제
      delete users[userId];
      // 사용자의 퀴즈 풀이 기록도 삭제
      historyRef.orderByChild('userId').equalTo(userId).once('value').then(snapshot => {
        snapshot.forEach(child => {
          child.ref.remove();
        });
      });
      
      // 변경사항 저장
      saveToFirebase('users', users);
      
      // 리스트 업데이트
      displayUserList();
      alert('계정이 성공적으로 삭제되었습니다.');
    }).catch(error => {
      console.error('계정 삭제 오류:', error);
      alert('계정 삭제 중 오류가 발생했습니다.');
    });
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
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    const joinDate = new Date(user.joinDate || Date.now()).toLocaleDateString();
    
    // 풀이 기록 표시/숨김 상태 관리
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
          ${user.quizHistory ? user.quizHistory.map(h => {
            const score = h.score || 0;
            const timestamp = h.timestamp ? new Date(h.timestamp).toLocaleString() : '날짜 정보 없음';
            const answer = h.answer || '정답 정보 없음';
            const correctClass = h.isCorrect ? 'correct' : 'incorrect';
            const correctText = h.isCorrect ? '정답' : '오답';
            
            // 오답인 경우 정답 표시
            const answerDisplay = `<p><strong>답변:</strong> ${h.userAnswer || '답변 정보 없음'}</p>${!h.isCorrect ? `<p><strong>정답:</strong> ${answer}</p>` : ''}`;

            return `<div class="history-item">
              <p><strong>문제:</strong> ${h.question || '문제 정보 없음'}</p>
              ${answerDisplay}
              <p><strong>점수:</strong> ${score}점</p>
              <p><strong>일시:</strong> ${timestamp}</p>
              <p class="${correctClass}">${correctText}</p>
            </div>`;
          }).join('') : '<p>풀이 기록이 없습니다.</p>'}
        </div>
      </div>
    `;
    userList.appendChild(userDiv);
  }
}

function toggleUserHistory(button, userId) {
  const userDiv = button.closest('.user-item');
  const historyContent = userDiv.querySelector('.history-content');
  const historyVisible = userDiv.dataset.historyVisible === 'true';

  // 풀이 기록 토글
  historyContent.style.display = historyVisible ? 'none' : 'block';
  userDiv.dataset.historyVisible = !historyVisible;
  
  // Firebase에서 최신 히스토리 데이터 불러오기
  const user = users[userId];
  if (user && user.quizHistory && !historyVisible) {
    const historyItems = historyContent.querySelector('.history-items');
    historyItems.innerHTML = user.quizHistory.map(h => {
      const score = h.score || 0;
      // 날짜 형식 검증
      const date = h.timestamp ? new Date(h.timestamp) : null;
      const timestamp = date && !isNaN(date.getTime()) ? date.toLocaleString() : '날짜가 저장되지 않았습니다.';
      
      // 정답 표시 로직 개선
      const answer = h.answer;
      const hasAnswer = answer !== undefined && answer !== null && answer !== '';
      const answerText = hasAnswer ? answer : '정답이 저장되지 않았습니다.';
      
      const correctClass = h.isCorrect ? 'correct' : 'incorrect';
      const correctText = h.isCorrect ? '정답' : '오답';
      
      // 오답인 경우 정답 표시
      const answerDisplay = `
        <p><strong>답변:</strong> ${h.userAnswer || '답변 정보 없음'}</p>
        ${!h.isCorrect && hasAnswer ? `<p><strong>정답:</strong> ${answerText}</p>` : ''}
      `;

      return `<div class="history-item">
        <p><strong>문제:</strong> ${h.question || '문제 정보 없음'}</p>
        ${answerDisplay}
        <p><strong>점수:</strong> ${score}점</p>
        <p><strong>일시:</strong> ${timestamp}</p>
        <p class="${correctClass}">${correctText}</p>
      </div>`;
    }).join('');
  }
}

function displayHistoryList() {
  const historyList = document.getElementById('adminHistoryTab');
  if (!historyList) {
    console.error('historyList 엘리먼트를 찾을 수 없습니다.');
    return;
  }

  // 히스토리 데이터 초기화
  historyList.innerHTML = '<div class="history-list"></div>';
  const historyContent = historyList.querySelector('.history-list');

  // Firebase에서 히스토리 데이터 불러오기
  historyRef.once('value').then(snapshot => {
    const historyData = snapshot.val() || {};
    
    // 사용자별 히스토리 그룹화
    const groupedHistory = {};
    Object.keys(historyData).forEach(key => {
      const history = historyData[key];
      if (history.userId) {
        if (!groupedHistory[history.userId]) {
          groupedHistory[history.userId] = [];
        }
        groupedHistory[history.userId].push(history);
      }
    });

    // 히스토리가 없을 때
    if (Object.keys(groupedHistory).length === 0) {
      historyContent.innerHTML = '<p>풀이 기록이 없습니다.</p>';
      return;
    }

    // 사용자별 히스토리 표시
    Object.entries(groupedHistory).forEach(([userId, history]) => {
      const user = users[userId];
      if (!user) return;

      const userDiv = document.createElement('div');
      userDiv.className = 'user-item';
      userDiv.innerHTML = `
        <div class="user-info">
          <h3>${user.name} (${userId})의 풀이 기록</h3>
          <div class="history-items">
            ${history.map(h => `
              <div class="history-item">
                <p><strong>문제:</strong> ${h.question}</p>
                <p><strong>답변:</strong> ${h.userAnswer}</p>
                <p><strong>점수:</strong> ${h.score}점</p>
                <p><strong>일시:</strong> ${new Date(h.timestamp).toLocaleString()}</p>
                <p class="${h.isCorrect ? 'correct' : 'incorrect'}">
                  ${h.isCorrect ? '정답' : '오답'}
                </p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      historyContent.appendChild(userDiv);
    });
  });
}

function deleteQuiz(index) {
  if (confirm('정말로 이 문제를 삭제하시겠습니까?')) {
    // Firebase에서 문제 삭제
    quizzesRef.child(index).remove().then(() => {
      // 로컬 데이터에서도 삭제
      quizzes.splice(index, 1);
      // Firebase에 업데이트
      quizzesRef.set(quizzes);
      // 화면 업데이트
      displayAdminQuizzes();
      alert('문제가 성공적으로 삭제되었습니다.');
    }).catch(error => {
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
    const incorrectQuestions = userHistory
      .filter(h => !h.isCorrect)
      .map(h => h.question);
    const correctQuestions = userHistory
      .filter(h => h.isCorrect)
      .map(h => h.question);
    
    // 오답 문제와 새로운 문제를 합침 (정답 문제는 제외)
    remainingQuestions = quizzes.filter(q => 
      incorrectQuestions.includes(q.question) || 
      !userHistory.some(h => h.question === q.question)
    ).filter(q => 
      !correctQuestions.includes(q.question)
    );
    
    // 오답 문제가 없으면 완료 메시지 표시
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
  }

  // 문제 선택
  randomIndex = Math.floor(Math.random() * remainingQuestions.length);
  quiz = remainingQuestions[randomIndex];
  currentQuestionIndex = quizzes.findIndex(q => q.question === quiz.question);

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
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
}

function submitAnswer() {
  const quiz = quizzes[currentQuestionIndex];
  let userAnswer = quiz.type === 'subjective' ? 
    document.getElementById('userAnswer').value.trim() : 
    document.querySelector('input[name="option"]:checked')?.value;
  
  if (!userAnswer) {
    alert(quiz.type === 'subjective' ? '답변을 입력해주세요.' : '보기를 선택해주세요.');
    return;
  }

  const isCorrect = quiz.type === 'subjective' ? 
    userAnswer.toLowerCase() === quiz.answer.toLowerCase() : 
    userAnswer === quiz.answer;

  const score = isCorrect ? 1 : 0;
  if (users[currentUser]) {
    users[currentUser].score = (users[currentUser].score || 0) + score;
    
    // 퀴즈 히스토리 저장
    const historyRef = database.ref('history');
    const historyData = {
      userId: currentUser,
      question: quiz.question,
      userAnswer: userAnswer,
      answer: quiz.answer,
      isCorrect: isCorrect,
      score: score,
      timestamp: new Date().toISOString()
    };

    historyRef.push(historyData).then(() => {
      // 사용자 히스토리 업데이트
      if (users[currentUser]) {
        users[currentUser].quizHistory = users[currentUser].quizHistory || [];
        users[currentUser].quizHistory.push(historyData);
        
        // 로컬 스토리지와 Firebase 동시 업데이트
        saveToLocalStorage('users', users);
        usersRef.child(currentUser).update({
          score: users[currentUser].score,
          quizHistory: users[currentUser].quizHistory
        });

        // 정답/오답에 따른 처리
        if (remainingQuestions.length === 0) {
          // 모든 문제를 풀었을 때 오답 문제와 새로운 문제만 남도록
          const userHistory = users[currentUser]?.quizHistory || [];
          const incorrectQuestions = userHistory
            .filter(h => !h.isCorrect)
            .map(h => h.question);
          const correctQuestions = userHistory
            .filter(h => h.isCorrect)
            .map(h => h.question);
          
          remainingQuestions = quizzes.filter(q => 
            incorrectQuestions.includes(q.question) || 
            !userHistory.some(h => h.question === q.question)
          ).filter(q => 
            !correctQuestions.includes(q.question)
          );
          
          if (remainingQuestions.length === 0) {
            document.getElementById('currentQuestion').textContent = `모든 문제를 풀었습니다! 당신의 점수: ${users[currentUser].score}점`;
            document.getElementById('nextButton').style.display = 'none';
            document.getElementById('endButton').style.display = 'inline-block';
          }
        } else {
          // 아직 모든 문제를 풀지 않았을 때는 현재 문제만 제거
          remainingQuestions = remainingQuestions.filter(q => q.question !== quiz.question);
        }

        // 결과 표시
        document.getElementById('quizResult').textContent = isCorrect ? '정답입니다!' : '오답입니다.';
        document.getElementById('submitButton').style.display = 'none';
        document.getElementById('nextButton').style.display = 'inline-block';
        document.getElementById('endButton').style.display = 'inline-block';

        // 다음 문제로 이동
        if (remainingQuestions.length === 0) {
          // 모든 문제를 풀었을 때는 다음 버튼을 숨기고 완료 메시지 표시
          document.getElementById('nextButton').style.display = 'none';
          document.getElementById('currentQuestion').textContent = `모든 문제를 풀었습니다! 당신의 점수: ${users[currentUser].score}점`;
        }
      }
    }).catch(error => {
      console.error('히스토리 저장 오류:', error);
      alert('풀이 기록 저장에 실패했습니다. 다시 시도해 주세요.');
    });
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

// 관리자 비밀번호 변경 함수
function changeAdminPassword() {
  if (!isAdminAuthenticated) {
    alert('먼저 관리자로 로그인하세요.');
    return;
  }

  const currentPassword = prompt('현재 관리자 비밀번호를 입력하세요:');
  
  if (!currentPassword) return;

  adminRef.once('value').then(snapshot => {
    const adminData = snapshot.val();
    if (adminData && adminData.password === currentPassword) {
      const newPassword = prompt('새로운 비밀번호를 입력하세요 (최소 8자):');
      if (newPassword && newPassword.length >= 8) {
        adminRef.set({
          password: newPassword,
          lastModified: new Date().toISOString()
        }).then(() => {
          alert('관리자 비밀번호가 성공적으로 변경되었습니다!');
          isAdminAuthenticated = false;
          showSection('adminLogin');
        }).catch(error => {
          console.error('비밀번호 변경 오류:', error);
          alert('비밀번호 변경 중 오류가 발생했습니다.');
        });
      } else {
        alert('새 비밀번호는 최소 8자 이상이어야 합니다.');
      }
    } else {
      alert('현재 비밀번호가 일치하지 않습니다.');
    }
  });
}

// 탭 전환 함수
function showAdminTab(tabId) {
  // 탭 버튼 스타일 업데이트
  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    }
  });

  // 컨텐츠 표시/숨김
  document.querySelectorAll('.admin-content').forEach(content => {
    content.classList.remove('active');
    if (content.id === `admin${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Tab`) {
      content.classList.add('active');
    }
  });
}

// Firebase 초기화 및 데이터 로드는 setupFirebase에서 처리됩니다
// 중복된 로드 이벤트 리스너 제거
