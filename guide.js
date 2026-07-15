const guideData = [
  {
    id: "welcome",
    title: "Welcome",
    icon: "ph-house",
    content: `
      <h1 style="font-size: 32px; color: var(--text-primary); margin-bottom: 24px;">Welcome to The FinTracker</h1>
      <p style="font-size: 16px; color: var(--text-secondary); max-width: 700px; margin-bottom: 32px; line-height: 1.6;">Welcome to The FinTracker — your personal financial management platform designed to help you organize your money, monitor your financial progress, and make informed financial decisions with confidence.</p>
      
      <div class="info-card" style="max-width: 700px; margin-bottom: 48px;">
        <h3 style="margin-top: 0; margin-bottom: 12px; color: var(--text-primary); font-size: 18px;">What You'll Learn</h3>
        <ul class="styled-list">
          <li><i class="ph ph-check-circle"></i> Configure your The FinTracker account</li>
          <li><i class="ph ph-check-circle"></i> Create Categorization Rules</li>
          <li><i class="ph ph-check-circle"></i> Upload Bank Statements</li>
          <li><i class="ph ph-check-circle"></i> Review and Confirm Transactions</li>
          <li><i class="ph ph-check-circle"></i> Monitor your Net Worth and Financial Progress</li>
        </ul>
      </div>
      
      <div class="guide-grid">
        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-target"></i></div>
          <h3>What The FinTracker helps you achieve</h3>
          <p>Whether you manage one bank account or multiple bank accounts, The FinTracker brings all your financial information together in one place, making it easier to understand your income, expenses, assets, liabilities, and overall financial position.</p>
          <ul class="styled-list">
            <li><i class="ph ph-check-circle"></i> Organize all your financial transactions in one place.</li>
            <li><i class="ph ph-check-circle"></i> Track your monthly income and expenses.</li>
            <li><i class="ph ph-check-circle"></i> Monitor your Net Worth.</li>
            <li><i class="ph ph-check-circle"></i> Analyze financial trends.</li>
            <li><i class="ph ph-check-circle"></i> Reduce manual work using smart categorization.</li>
            <li><i class="ph ph-check-circle"></i> Build better financial habits through meaningful insights.</li>
          </ul>
        </div>
        
        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-users"></i></div>
          <h3>Who is it designed for?</h3>
          <p>The FinTracker is suitable for anyone who wants better control over personal finances. No financial expertise is required.</p>
          <ul class="styled-list">
            <li><i class="ph ph-check-circle"></i> Students</li>
            <li><i class="ph ph-check-circle"></i> Working Professionals</li>
            <li><i class="ph ph-check-circle"></i> Freelancers</li>
            <li><i class="ph ph-check-circle"></i> Business Owners</li>
          </ul>
          
          <div class="tip-box" style="margin-top: 24px;">
            <i class="ph ph-lightbulb"></i> Ready to begin? Move to the <strong>Getting Started</strong> section.
          </div>
        </div>
      </div>
    `
  },
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "ph-rocket",
    content: `
      <h1 style="font-size: 32px; color: var(--text-primary); margin-bottom: 24px;">Getting Started</h1>
      <p style="font-size: 16px; color: var(--text-secondary); max-width: 700px; margin-bottom: 48px; line-height: 1.6;">Follow these sequential steps to configure your The FinTracker and begin monitoring your financial health.</p>

      <div class="guide-grid">
      <div class="step-card">
        <div class="step-icon"><i class="ph ph-user-plus"></i></div>
        <div class="step-content">
          <div class="step-number">Step 01</div>
          <h3>Create Your Account</h3>
          <p>Getting started is simple.</p>
          <ul class="styled-list">
            <li><i class="ph ph-check-circle"></i> Create your account.</li>
            <li><i class="ph ph-check-circle"></i> Verify your email if required.</li>
            <li><i class="ph ph-check-circle"></i> Login.</li>
          </ul>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 12px;"><i class="ph ph-shield-check text-green"></i> Your financial data remains private and accessible only to you.</p>
        </div>
      </div>

      <div class="step-card">
        <div class="step-icon"><i class="ph ph-faders"></i></div>
        <div class="step-content">
          <div class="step-number">Step 02</div>
          <h3>Configure Categorization Rules <span style="font-size: 12px; font-weight: normal; color: var(--text-secondary);">(Recommended First Step)</span></h3>
          <p>Before uploading your first bank statement, configure your Categorization Rules. Categorization Rules allow The FinTracker to automatically classify recurring transactions while importing bank statements.</p>
          <div class="info-card" style="margin-top: 16px;">
            <strong>Examples of keywords:</strong>
            <p>SWIGGY, AMAZON, ZOMATO, UBER</p>
          </div>
          <div class="tip-box" style="margin-top: 16px;"><i class="ph ph-lightbulb"></i> Creating rules beforehand significantly reduces manual categorization.</div>
        </div>
      </div>

      <div class="step-card">
        <div class="step-icon"><i class="ph ph-cloud-arrow-up"></i></div>
        <div class="step-content">
          <div class="step-number">Step 03</div>
          <h3>Upload Your First Bank Statement</h3>
          <ol class="styled-list" style="margin-top: 12px;">
            <li>Open <strong>Financial Records → Upload Statement</strong>.</li>
            <li>Select your Bank.</li>
            <li>Upload Statement.</li>
          </ol>
        </div>
      </div>
      
      <div class="step-card">
        <div class="step-icon"><i class="ph ph-magnifying-glass"></i></div>
        <div class="step-content">
          <div class="step-number">Step 04</div>
          <h3>Review Uploaded Transactions</h3>
          <p>After uploading a statement, imported transactions appear only inside the Upload Statement page. At this stage users can:</p>
          <ul class="styled-list">
            <li><i class="ph ph-check-circle"></i> Review transactions</li>
            <li><i class="ph ph-check-circle"></i> Edit transaction details</li>
            <li><i class="ph ph-check-circle"></i> Update Category / Subcategory</li>
            <li><i class="ph ph-check-circle"></i> Split Transactions</li>
            <li><i class="ph ph-check-circle"></i> Verify imported data</li>
          </ul>
        </div>
      </div>
      
      <div class="step-card">
        <div class="step-icon"><i class="ph ph-check-square"></i></div>
        <div class="step-content">
          <div class="step-number">Step 05</div>
          <h3>Confirm Transactions</h3>
          <p>Only after clicking <strong>Confirm</strong> are those transactions moved to Confirmed Transactions and included in all reports.</p>
        </div>
      </div>
      
      <div class="step-card">
        <div class="step-icon"><i class="ph ph-chart-pie-slice"></i></div>
        <div class="step-content">
          <div class="step-number">Step 06</div>
          <h3>Explore Dashboard</h3>
          <p>Dashboard includes:</p>
          <ul class="styled-list">
            <li><i class="ph ph-check-circle"></i> Monthly Summary</li>
            <li><i class="ph ph-check-circle"></i> Annual Analysis</li>
            <li><i class="ph ph-check-circle"></i> Net Worth</li>
          </ul>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 12px;">These update automatically using confirmed transactions.</p>
        </div>
      </div>
      </div>
    `
  },
  {
    id: "features",
    title: "Features",
    icon: "ph-sparkle",
    content: `
      <h1 style="font-size: 32px; color: var(--text-primary); margin-bottom: 48px;">Features</h1>

      <div class="guide-grid">
        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-calendar-check"></i></div>
          <h3>Monthly Summary</h3>
          <p><strong>What is it?</strong> A comprehensive view of your financial activity for a specific month.</p>
          <p><strong>Why is it useful?</strong> It provides a quick breakdown of your total income, expenses, and savings, helping you stay on top of your monthly budget.</p>
          <p><strong>How to use it?</strong> Navigate to <em>Dashboard → Monthly Summary</em> and select the desired month from the dropdown.</p>
          <div class="tip-box"><i class="ph ph-lightbulb"></i> Use the trend charts to see how your spending fluctuates throughout the month.</div>
        </div>

        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-chart-line-up"></i></div>
          <h3>Annual Analysis</h3>
          <p><strong>What is it?</strong> A high-level overview of your financial performance across the entire year.</p>
          <p><strong>Why is it useful?</strong> It allows you to identify long-term trends, seasonal spending habits, and yearly growth in savings.</p>
          <p><strong>How to use it?</strong> Navigate to <em>Dashboard → Annual Analysis</em> and review the year-to-date metrics and category breakdowns.</p>
          <div class="tip-box"><i class="ph ph-lightbulb"></i> Compare current year data with previous years to measure financial growth.</div>
        </div>

        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-coins"></i></div>
          <h3>Net Worth</h3>
          <p><strong>What is it?</strong> A tracker that calculates the difference between your total assets and total liabilities.</p>
          <p><strong>Why is it useful?</strong> It is the most accurate indicator of your overall financial health and wealth accumulation over time.</p>
          <p><strong>How to use it?</strong> Navigate to <em>Dashboard → Net Worth</em> to view your current net worth and historical progression chart.</p>
          <div class="tip-box"><i class="ph ph-lightbulb"></i> Consistently categorizing asset purchases and loan repayments ensures an accurate net worth calculation.</div>
        </div>

        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-file-csv"></i></div>
          <h3>Upload Statement</h3>
          <p><strong>What is it?</strong> A module to import your bank statements directly into The FinTracker.</p>
          <p><strong>Why is it useful?</strong> It automates data entry and uses your Categorization Rules to instantly classify hundreds of transactions.</p>
          <p><strong>How to use it?</strong> Navigate to <em>Financial Records → Upload Statement</em>, choose your bank, and upload the CSV or Excel file.</p>
          <div class="tip-box"><i class="ph ph-lightbulb"></i> Always review pending transactions carefully before confirming them.</div>
        </div>

        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-receipt"></i></div>
          <h3>Confirmed Transactions</h3>
          <p><strong>What is it?</strong> The centralized database of all your verified and approved financial transactions.</p>
          <p><strong>Why is it useful?</strong> It serves as the single source of truth for all reports, calculations, and summaries across the application.</p>
          <p><strong>How to use it?</strong> Navigate to <em>Financial Records → Confirmed Transactions</em> to search, filter, edit, or delete existing records.</p>
          <div class="tip-box"><i class="ph ph-lightbulb"></i> Use the global search and filters to quickly find specific past transactions.</div>
        </div>

        <div class="feature-card">
          <div class="feat-icon"><i class="ph ph-clipboard-text"></i></div>
          <h3>Monthly Snapshot</h3>
          <p><strong>What is it?</strong> A quick summary capturing the starting and ending balances for a given month.</p>
          <p><strong>Why is it useful?</strong> It acts as a reconciliation tool to ensure your tracked data aligns perfectly with your actual bank balances.</p>
          <p><strong>How to use it?</strong> Navigate to <em>Financial Records → Monthly Snapshot</em> to view the reconciliation data.</p>
          <div class="tip-box"><i class="ph ph-lightbulb"></i> If your snapshot ending balance differs from your actual bank statement, you may have missed uploading some transactions.</div>
        </div>
      </div>

      <div class="feature-card" style="margin-top: 24px;">
        <div class="feat-icon"><i class="ph ph-faders-horizontal"></i></div>
        <h3>Categorization Rules</h3>
        <p><strong>What keyword means:</strong> A specific word or phrase found in the transaction description (e.g., merchant name).</p>
        <p><strong>Why keyword based categorization exists:</strong> To automate the repetitive task of manually assigning categories to recurring transactions.</p>
        <div class="info-card" style="margin-top: 16px;">
          <strong>Example:</strong>
          <p>Keyword: <strong>SWIGGY</strong> &nbsp;|&nbsp; Category: <strong>Expense</strong> &nbsp;|&nbsp; Subcategory: <strong>Food & Dining</strong></p>
          <p style="font-size:13px; color:var(--text-secondary); margin-top:8px;">Whenever the uploaded statement contains "SWIGGY", The FinTracker automatically categorizes it.</p>
        </div>
      </div>

      <div class="feature-card" style="margin-top: 24px;">
        <div class="feat-icon"><i class="ph ph-scissors"></i></div>
        <h3>Split Transaction</h3>
        <p><strong>Purpose:</strong> One bank transaction may belong to multiple Categories/Subcategories.</p>
        <div class="info-card" style="margin-top: 16px;">
          <strong>Example: Restaurant Bill ₹500</strong>
          <ul class="styled-list" style="margin-top:8px;">
            <li>Expense → Food & Dining → ₹250</li>
            <li>Asset → Receivable → ₹250</li>
          </ul>
          <p style="font-size:13px; color:var(--text-secondary); margin-top:8px;">Splitting improves reporting accuracy.</p>
        </div>
      </div>
    `
  },
  {
    id: "faq",
    title: "FAQ",
    icon: "ph-question",
    content: `
      <h1 style="font-size: 32px; color: var(--text-primary); margin-bottom: 24px;">Frequently Asked Questions</h1>
      <p style="font-size: 16px; color: var(--text-secondary); max-width: 700px; margin-bottom: 48px; line-height: 1.6;">Find answers to the most common questions about the The FinTracker platform.</p>
      
      <div class="faq-list">
        <details class="faq-accordion">
          <summary><i class="ph ph-bank"></i> Which bank statements are supported? <i class="ph ph-caret-down acc-arrow"></i></summary>
          <div class="acc-content">
            <p>The FinTracker currently supports direct uploads for Kotak Mahindra Bank, State Bank of India (SBI), and HDFC Bank statements in CSV or Excel formats.</p>
          </div>
        </details>

        <details class="faq-accordion">
          <summary><i class="ph ph-pencil-simple"></i> Can I edit transactions? <i class="ph ph-caret-down acc-arrow"></i></summary>
          <div class="acc-content">
            <p>Yes. You can edit transactions during the initial upload review phase, and you can also edit any Confirmed Transaction at any time from the Confirmed Transactions page.</p>
          </div>
        </details>

        <details class="faq-accordion">
          <summary><i class="ph ph-files"></i> Can I upload statements from multiple banks? <i class="ph ph-caret-down acc-arrow"></i></summary>
          <div class="acc-content">
            <p>Yes. You can upload statements from any of the supported banks. Use the Bank filter on the Confirmed Transactions page to view data from specific accounts.</p>
          </div>
        </details>

        <details class="faq-accordion">
          <summary><i class="ph ph-copy"></i> What happens if I upload the same statement twice? <i class="ph ph-caret-down acc-arrow"></i></summary>
          <div class="acc-content">
            <p>You will need to manually delete the duplicate pending transactions during the review phase before confirming them to prevent duplicate entries in your reports.</p>
          </div>
        </details>

        <details class="faq-accordion">
          <summary><i class="ph ph-shield-check"></i> Is my financial data secure? <i class="ph ph-caret-down acc-arrow"></i></summary>
          <div class="acc-content">
            <p>Yes. Your financial data is private, encrypted, and accessible only to you through your authenticated account.</p>
          </div>
        </details>
      </div>
    `
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: "ph-wrench",
    content: `
      <h1 style="font-size: 32px; color: var(--text-primary); margin-bottom: 48px;">Troubleshooting</h1>
      
      <div class="guide-grid">
        <div class="troubleshoot-card">
          <div class="ts-icon"><i class="ph ph-warning-circle"></i></div>
          <div class="ts-content">
            <h3>Statement upload failed</h3>
            <p>Ensure you are uploading the correct file format (.csv, .xls, .xlsx). If the file is modified, the headers might not match the required format. Download a fresh statement from your bank and try again.</p>
          </div>
        </div>

        <div class="troubleshoot-card">
          <div class="ts-icon"><i class="ph ph-lock-key"></i></div>
          <div class="ts-content">
            <h3>Password protected Excel</h3>
            <p>The FinTracker cannot read password-protected files. Open the statement in Excel, remove the password protection, save the file, and then upload it.</p>
          </div>
        </div>

        <div class="troubleshoot-card">
          <div class="ts-icon"><i class="ph ph-eye-slash"></i></div>
          <div class="ts-content">
            <h3>Transactions not visible</h3>
            <p>Check if the transactions are still in the <strong>Upload Statement</strong> (Pending) phase. Transactions will not appear in the Dashboard or Confirmed Transactions until you select and confirm them.</p>
          </div>
        </div>

        <div class="troubleshoot-card">
          <div class="ts-icon"><i class="ph ph-tag"></i></div>
          <div class="ts-content">
            <h3>Wrong transaction category</h3>
            <p>If an automated rule applied the wrong category, you can edit the transaction directly. To prevent this in the future, navigate to <strong>Categorization Rules</strong> and update the keyword mapping to be more specific.</p>
          </div>
        </div>

        <div class="troubleshoot-card">
          <div class="ts-icon"><i class="ph ph-sign-in"></i></div>
          <div class="ts-content">
            <h3>Unable to login</h3>
            <p>Verify your email and password. If you forgot your password, use the "Forgot Password" link on the login screen to receive a password reset email.</p>
          </div>
        </div>
      </div>
    `
  }
];

function openGuide() {
  document.getElementById('pg-guide').classList.remove('hide');
  
  var home = document.getElementById('pg-home'); if(home) home.classList.add('hide');
  var dash = document.getElementById('pg-dash'); if(dash) dash.classList.add('hide');
  var lm = document.getElementById('landing-main'); if(lm) lm.style.display = 'block';
  
  window.scrollTo(0, 0);
  document.title = "The FinTracker – User Guide";
  
  if (!document.getElementById('guide-rendered')) {
    renderGuide();
  }
}

function closeGuide() {
  document.getElementById('pg-guide').classList.add('hide');
  document.title = "The FinTracker";
  
  if(window.currentUser) {
    var dash = document.getElementById('pg-dash'); if(dash) dash.classList.remove('hide');
  } else {
    var home = document.getElementById('pg-home'); if(home) home.classList.remove('hide');
  }
}

function renderGuide() {
  const navContainer = document.getElementById('guide-nav-items');
  const contentContainer = document.getElementById('guide-content-area');
  
  navContainer.innerHTML = '';
  contentContainer.innerHTML = '';
  
  guideData.forEach((section, index) => {
    // Nav item
    const navItem = document.createElement('div');
    navItem.className = 'guide-nav-item' + (index === 0 ? ' active' : '');
    navItem.innerHTML = `<i class="ph ${section.icon}"></i> ${section.title}`;
    navItem.onclick = () => {
      document.getElementById('guide-sec-' + section.id).scrollIntoView({ behavior: 'smooth' });
    };
    navContainer.appendChild(navItem);
    
    // Content section
    const contentSec = document.createElement('div');
    contentSec.className = 'guide-section';
    contentSec.id = 'guide-sec-' + section.id;
    contentSec.innerHTML = section.content;
    contentContainer.appendChild(contentSec);
  });
  
  // Mark as rendered
  const marker = document.createElement('div');
  marker.id = 'guide-rendered';
  marker.style.display = 'none';
  contentContainer.appendChild(marker);
  
  // Scroll spy
  contentContainer.addEventListener('scroll', () => {
    let currentId = '';
    const sections = document.querySelectorAll('.guide-section');
    sections.forEach(sec => {
      const sectionTop = sec.offsetTop - contentContainer.offsetTop;
      if (contentContainer.scrollTop >= sectionTop - 200) {
        currentId = sec.id.replace('guide-sec-', '');
      }
    });
    
    document.querySelectorAll('.guide-nav-item').forEach((item, idx) => {
      item.classList.remove('active');
      if (guideData[idx].id === currentId) {
        item.classList.add('active');
      }
    });
  });
}


