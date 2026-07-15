import re
with open('app.js', 'r', encoding='utf-8') as f:
    code = f.read()

pattern = r'function renderNetWorth\(\) \{\s*showLoading\([^)]*\);\s*Promise\.all\(\[getOpeningBalances\(\), getAllTxns\(\), getAllSnapshots\(\)\]\)\.then\(function\(results\) \{\s*var ob=results\[0\], at=results\[1\], as=results\[2\];\s*var d=getMonthYear\(\);'

replacement = """function renderNetWorth() {
  showLoading('Loading net worth...');
  Promise.all([getOpeningBalances(), getAllTxns(), getAllSnapshots()]).then(function(results) {
    var ob=results[0], at=results[1], as=results[2];
    
    if (at && at.length === 0) {
      document.getElementById('pg-dash-body').innerHTML = `
      <div style="padding: 32px; max-width: 800px; margin: 0 auto; animation: fade-in 0.3s ease;">
        <h2 style="font-size: 28px; color: var(--text-primary); margin-bottom: 8px;">Welcome to The FinTracker</h2>
        <p style="color: var(--text-secondary); margin-bottom: 32px; font-size: 15px; line-height: 1.6;">Welcome aboard! Complete the following onboarding steps to configure your account and unlock your financial dashboard.</p>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <div class="step-card" style="cursor: pointer; border-left: 4px solid var(--blue); background: var(--bg-card); transition: all 0.2s;" onclick="onboardingStep1()" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div class="step-icon"><i class="ph ph-faders"></i></div>
            <div class="step-content">
              <div class="step-number" style="color: var(--blue); font-weight: 600;">Step 1</div>
              <h3 style="margin: 4px 0 8px 0;">Configure Rules</h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Set up categorization rules to automate your transaction tracking.</p>
              <button class="btn btn-blue" style="margin-top: 16px; width: fit-content;">Start Configuration</button>
            </div>
          </div>

          <div class="step-card" style="opacity: 0.6; pointer-events: none; background: var(--bg-card);">
            <div class="step-icon"><i class="ph ph-cloud-arrow-up"></i></div>
            <div class="step-content">
              <div class="step-number">Step 2</div>
              <h3 style="margin: 4px 0 8px 0; display: flex; align-items: center; gap: 8px;">Upload Statement <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-secondary);"><i class="ph ph-lock"></i> Locked</span></h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Import your first bank statement safely and securely.</p>
            </div>
          </div>

          <div class="step-card" style="opacity: 0.6; pointer-events: none; background: var(--bg-card);">
            <div class="step-icon"><i class="ph ph-magnifying-glass"></i></div>
            <div class="step-content">
              <div class="step-number">Step 3</div>
              <h3 style="margin: 4px 0 8px 0; display: flex; align-items: center; gap: 8px;">Review Transactions <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-secondary);"><i class="ph ph-lock"></i> Locked</span></h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Verify and categorize your imported transactions.</p>
            </div>
          </div>

          <div class="step-card" style="opacity: 0.6; pointer-events: none; background: var(--bg-card);">
            <div class="step-icon"><i class="ph ph-check-square"></i></div>
            <div class="step-content">
              <div class="step-number">Step 4</div>
              <h3 style="margin: 4px 0 8px 0; display: flex; align-items: center; gap: 8px;">Confirm Transactions <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-secondary);"><i class="ph ph-lock"></i> Locked</span></h3>
              <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Approve your transactions to permanently unlock your dashboard.</p>
            </div>
          </div>

        </div>
      </div>
      `;
      return;
    }

    var d=getMonthYear();"""

new_code, count = re.subn(pattern, replacement, code)
if count > 0:
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_code)
    print('SUCCESS')
else:
    print('FAILED TO MATCH')
