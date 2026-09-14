// localStorage에 저장할 때 사용할 키 이름.
// 이 문자열을 기준으로 브라우저에 구독 데이터를 보관한다.
const STORAGE_KEY = 'sub_tracker_data';

// 앱에서 현재 화면에 표시할 구독 목록과 수정 중인 항목의 id를 관리하는 상태 객체.
// 이 상태는 화면 렌더링 시점마다 참조되며, 데이터 변경 후 다시 그리기를 트리거한다.
const appState = {
  subscriptions: [],
  editingId: null
};

// 오늘 날짜를 "YYYY-MM-DD" 형식으로 반환한다.
// input[type="date"]는 이 문자열 포맷을 요구하므로, 기본값 설정 시 사용된다.
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

// 앱을 처음 실행할 때 보여줄 예시 데이터를 생성한다.
// 현재 날짜 기준으로 3~44일 뒤 결제일이 나오도록 계산하여 화면이 바로 채워지게 한다.
function createSampleData() {
  const today = new Date();

  // 기준 날짜에서 몇 일 뒤의 날짜를 문자열로 반환하는 헬퍼 함수.
  function addDays(days) {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  return [
    {
      id: 'sub_1',
      name: '넷플릭스',
      amount: 13500,
      cycle: 'monthly',
      nextPaymentDate: addDays(3),
      category: '영상'
    },
    {
      id: 'sub_2',
      name: '스포티파이',
      amount: 10900,
      cycle: 'monthly',
      nextPaymentDate: addDays(7),
      category: '음악'
    },
    {
      id: 'sub_3',
      name: '헬스장',
      amount: 45000,
      cycle: 'monthly',
      nextPaymentDate: addDays(12),
      category: '운동'
    },
    {
      id: 'sub_4',
      name: '클라우드',
      amount: 120000,
      cycle: 'yearly',
      nextPaymentDate: addDays(44),
      category: '생산성'
    }
  ];
}

// localStorage에서 구독 목록을 읽어온다.
// 데이터가 없으면 기본 더미 데이터를 만든 뒤 저장하고, 이후에는 저장된 값을 다시 사용한다.
function loadSubscriptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaultData = createSampleData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
      return defaultData;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : createSampleData();
  } catch (error) {
    console.error('localStorage 로딩 중 오류:', error);
    return createSampleData();
  }
}

// 현재 appState.subscriptions 배열을 JSON 문자열로 변환해서 localStorage에 저장한다.
// 이렇게 해야 새로고침해도 사용자가 입력한 구독 목록이 유지된다.
function saveSubscriptions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.subscriptions));
}

// 화면을 다시 그린다.
// 요약 카드, 카테고리 비중, 구독 목록이 모두 현재 상태를 기준으로 갱신된다.
function render() {
  UI.renderSummary(appState.subscriptions);
  UI.renderCategoryChart(appState.subscriptions);
  UI.renderSubscriptionList(appState.subscriptions, {
    onEdit: handleEdit,
    onDelete: handleDelete
  });
}

// 특정 구독을 수정하기 위해 폼에 기존 값을 채워 넣는 함수.
// 수정 버튼을 누르면 해당 구독의 id를 찾고, 그 데이터를 input 요소에 세팅한다.
function handleEdit(id) {
  const subscription = appState.subscriptions.find((item) => item.id === id);
  if (!subscription) return;

  appState.editingId = id;
  document.getElementById('subscriptionId').value = id;
  document.getElementById('name').value = subscription.name;
  document.getElementById('amount').value = subscription.amount;
  document.getElementById('cycle').value = subscription.cycle;
  document.getElementById('nextPaymentDate').value = subscription.nextPaymentDate;
  document.getElementById('category').value = subscription.category;

  document.getElementById('submitButton').textContent = '수정하기';
  document.getElementById('cancelEditButton').hidden = false;
  document.getElementById('name').focus();
}

// 폼을 기본 상태로 되돌린다.
// 신규 추가 모드로 전환할 때 호출되며, 입력값, 버튼 텍스트, 수정 중 id를 초기화한다.
function resetForm() {
  document.getElementById('subscriptionForm').reset();
  document.getElementById('subscriptionId').value = '';
  document.getElementById('submitButton').textContent = '추가하기';
  document.getElementById('cancelEditButton').hidden = true;
  appState.editingId = null;
}

// 특정 구독을 삭제한다.
// confirm 창으로 한 번 더 확인 후 목록에서 제거하고, 저장 후 다시 화면을 그린다.
function handleDelete(id) {
  const confirmDelete = window.confirm('이 구독을 삭제할까요?');
  if (!confirmDelete) return;

  appState.subscriptions = appState.subscriptions.filter((item) => item.id !== id);
  saveSubscriptions();
  render();

  if (appState.editingId === id) {
    resetForm();
  }
}

// 폼 제출 이벤트 처리 함수.
// 새 구독 추가와 기존 구독 수정 양쪽을 모두 이 함수에서 처리한다.
// appState.editingId 값이 있으면 수정, 없으면 추가로 동작한다.
function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const nextSubscription = {
    id: appState.editingId || `sub_${Date.now()}`,
    name: String(formData.get('name') || '').trim(),
    amount: Number(formData.get('amount')),
    cycle: String(formData.get('cycle') || 'monthly'),
    nextPaymentDate: String(formData.get('nextPaymentDate') || '').trim(),
    category: String(formData.get('category') || '').trim()
  };

  // 필수 항목이 비어 있으면 사용자에게 안내하고 저장을 중단한다.
  if (!nextSubscription.name || !nextSubscription.nextPaymentDate || !nextSubscription.category) {
    alert('필수 항목을 모두 입력해주세요.');
    return;
  }

  // 금액은 0 이하가 될 수 없도록 검증한다.
  if (!Number.isFinite(nextSubscription.amount) || nextSubscription.amount <= 0) {
    alert('금액은 0보다 큰 숫자로 입력해주세요.');
    return;
  }

  // 수정 모드라면 해당 id를 가진 기존 항목을 새 값으로 교체하고,
  // 추가 모드라면 배열의 끝에 새 요소를 push 한다.
  if (appState.editingId) {
    appState.subscriptions = appState.subscriptions.map((item) =>
      item.id === appState.editingId ? nextSubscription : item
    );
  } else {
    appState.subscriptions.push(nextSubscription);
  }

  saveSubscriptions();
  resetForm();
  render();
}

// 결제 예정일 기본값을 오늘 날짜로 넣어준다.
// 사용자가 날짜를 매번 선택하지 않아도 편하게 입력할 수 있게 한다.
function initializeFormDefaults() {
  const today = getTodayString();
  const dateInput = document.getElementById('nextPaymentDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = today;
  }
}

// 앱 초기화 함수.
// 저장된 데이터 로딩, 폼 이벤트 바인딩, 기본값 세팅, 최초 렌더링을 한 번에 수행한다.
function init() {
  appState.subscriptions = loadSubscriptions();

  const form = document.getElementById('subscriptionForm');
  form.addEventListener('submit', handleSubmit);

  document.getElementById('cancelEditButton').addEventListener('click', resetForm);
  initializeFormDefaults();
  render();
}

// 스크립트가 로드되자마자 init()를 실행해 앱을 동작시키기 시작한다.
init();
