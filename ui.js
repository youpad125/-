// 화면에 실제로 출력되는 DOM 조작 로직을 모아 둔 객체.
// 여기 있는 함수들은 계산 함수의 결과를 받아서 HTML 텍스트와 카드 UI로 바꿔준다.
const UI = {
  // 숫자를 한국 원화 형식으로 바꿔서 화면에 보여준다.
  // 예: 13500 -> "₩13,500"
  formatCurrency(amount) {
    const value = Number(amount || 0);
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(value);
  },

  // YYYY-MM-DD 형식의 문자열을 화면에서 읽기 쉬운 날짜 문자열로 바꾼다.
  // 예: "2026-08-16" -> "8월 16일"
  formatDate(dateString) {
    if (!dateString) return '날짜 없음';

    const date = new Date(`${dateString}T00:00:00`);
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  },

  // 결제일이 오늘 기준 몇 일 남았는지 D-Day 배지 문자열을 계산한다.
  // 값이 0이면 D-Day, 양수면 D-3, 음수면 D+1처럼 표시한다.
  getDueBadgeText(subscription) {
    const today = new Date();
    const target = new Date(`${subscription.nextPaymentDate}T00:00:00`);
    const diff = Math.floor((target - today) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  },

  // 상단 요약 영역을 다시 계산해서 채운다.
  // 월 합계, 연간 합계, 이번 주 결제 예정 건수를 갱신한다.
  renderSummary(subscriptions) {
    const monthlyTotal = getTotalMonthlyAmount(subscriptions);
    const yearlyTotal = getTotalYearlyAmount(subscriptions);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = getSubscriptionsDueWithinDays(subscriptions, today, 7);

    document.getElementById('monthlyTotal').textContent = this.formatCurrency(monthlyTotal);
    document.getElementById('yearlyTotal').textContent = this.formatCurrency(yearlyTotal);
    document.getElementById('upcomingWeek').textContent = `${upcoming.length}건`;
  },

  // 카테고리별 월별 지출 비중을 막대 형태로 렌더링한다.
  // getMonthlyAmountByCategory() 결과를 객체로 받아서 퍼센트 비율을 계산한다.
  renderCategoryChart(subscriptions) {
    const categoryMap = getMonthlyAmountByCategory(subscriptions);
    const entries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    const container = document.getElementById('categoryChart');

    // 데이터가 비어 있거나 총합이 0이면 안내 문구를 보여준다.
    if (!entries.length || total === 0) {
      container.innerHTML = '<div class="empty-state">카테고리 데이터가 없습니다.</div>';
      return;
    }

    const rowMarkup = entries
      .map(([category, amount]) => {
        const ratio = (amount / total) * 100;
        return `
          <div class="category-row">
            <div class="category-meta">
              <span>${category}</span>
              <strong>${this.formatCurrency(amount)}</strong>
            </div>
            <div class="category-bar">
              <div class="category-fill" style="width: ${ratio}%"></div>
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = rowMarkup;
  },

  // 구독 목록 전체를 카드 형태로 화면에 출력한다.
  // 각 카드에는 이름, 월 금액, 결제 날짜, D-day, 수정/삭제 버튼이 포함된다.
  renderSubscriptionList(subscriptions, handlers) {
    const list = document.getElementById('subscriptionList');

    // 구독이 하나도 없으면 빈 상태 메시지를 보여준다.
    if (!subscriptions.length) {
      list.innerHTML = '<div class="empty-state">아직 등록된 구독이 없어요. 아래에서 추가해 보세요.</div>';
      return;
    }

    list.innerHTML = subscriptions
      .map((sub) => {
        const monthlyAmount = getMonthlyAmount(sub);
        const dueText = this.getDueBadgeText(sub);
        const paymentDate = this.formatDate(sub.nextPaymentDate);

        return `
          <article class="subscription-card">
            <div class="card-top">
              <div>
                <h3 class="card-name">${sub.name}</h3>
                <div class="card-amount">${this.formatCurrency(monthlyAmount)}</div>
              </div>
              <div class="card-badges">
                <span class="badge">${sub.category || '기타'}</span>
                <span class="badge soft">${dueText}</span>
              </div>
            </div>

            <div class="card-info">
              <span>${sub.cycle === 'yearly' ? '연간 결제' : '월간 결제'}</span>
              <span>${paymentDate} 결제 예정</span>
            </div>

            <div class="card-actions">
              <button class="card-action edit" type="button" data-action="edit" data-id="${sub.id}">수정</button>
              <button class="card-action delete" type="button" data-action="delete" data-id="${sub.id}">삭제</button>
            </div>
          </article>
        `;
      })
      .join('');

    // 새로 생성된 수정/삭제 버튼에 클릭 이벤트를 연결한다.
    // handlers.onEdit와 handlers.onDelete는 main.js의 함수로 연결된다.
    list.querySelectorAll('[data-action="edit"]').forEach((button) => {
      button.addEventListener('click', (event) => handlers.onEdit(event.currentTarget.dataset.id));
    });

    list.querySelectorAll('[data-action="delete"]').forEach((button) => {
      button.addEventListener('click', (event) => handlers.onDelete(event.currentTarget.dataset.id));
    });
  }
};

// 다른 파일(main.js)에서 UI 객체를 사용하도록 전역으로 노출한다.
// 이렇게 해야 script 순서가 상관없이 UI.renderSummary 같은 함수를 호출할 수 있다.
window.UI = UI;
