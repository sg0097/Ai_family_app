import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';

/** Replace with the real support address before launch (see README, "Launch checklist"). */
export const SUPPORT_EMAIL = 'support@example.com';
const UPDATED = '12 November 2026';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px', lineHeight: 1.65 }}>
      <Link to="/" style={{ textDecoration: 'none' }}><Logo /></Link>
      <h1 style={{ margin: '28px 0 4px' }}>{title}</h1>
      <p className="muted small">Last updated {UPDATED}</p>
      {children}
    </div>
  );
}

export function Privacy() {
  return (
    <Shell title="Privacy">
      <p>Family Care carries a child’s reminders to a parent on WhatsApp and shows the child how the day went. This page says what we keep and why, in plain words.</p>
      <h3>What we collect</h3>
      <ul>
        <li><b>The child:</b> name, email, password (stored hashed, never readable), WhatsApp number if given, time zone.</li>
        <li><b>The parent:</b> name, WhatsApp number, language, and what they reply: “done”, “not yet”, readings such as blood pressure or sugar, how they feel, and messages they send.</li>
        <li><b>Voice notes</b> the child records, so they can be played to the parent.</li>
        <li><b>Payments:</b> handled by Razorpay. We never see or store card or UPI details; we keep the amount, plan and payment reference.</li>
      </ul>
      <h3>The parent’s consent</h3>
      <p>Nothing is sent to a parent until they say yes on WhatsApp. They can send <b>STOP</b> at any time and messages end. We only message numbers whose owner agreed.</p>
      <h3>Who sees it</h3>
      <p>The child who added the parent, and brothers and sisters the child invites. Nobody else. We do not sell data and do not show advertising. Messages travel through WhatsApp (Meta), and payments through Razorpay; both have their own policies. Our hosting and database providers store the data for us.</p>
      <h3>Readings and health information</h3>
      <p>We show readings exactly as the parent sent them. We do not judge them, diagnose, or predict anything. Version 1 does not use an AI model.</p>
      <h3>Keeping and deleting</h3>
      <p>Remove a parent in Settings and their messages, readings and voice notes are deleted. To delete your whole account or ask what we hold, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      <h3>Contact</h3>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms">
      <h3>Not a medical service</h3>
      <p>Family Care is a way for a child to stay involved in a parent’s day. It does not give medical advice, does not diagnose, and does not replace a doctor or a phone call. <b>In an emergency, call 112 or your local emergency number.</b> A reminder or an evening note can be late, can fail to arrive, or can be wrong; do not rely on it for anyone’s safety.</p>
      <h3>Who can use it</h3>
      <p>You must be 18 or older and add only a parent or family member who has agreed to receive messages. You are responsible for having their consent.</p>
      <h3>Plans and payment</h3>
      <p>New accounts get a 7-day free trial. After that, <b>Basic is ₹100 per parent per month</b> and <b>Premium is ₹149 per parent per month</b>. You pay one month at a time through Razorpay; nothing renews automatically. When a plan ends, reminders stop until you pay again. Payments are non-refundable except where the law requires, or where we failed to deliver the service; write to us and we will look at it fairly.</p>
      <h3>Using it properly</h3>
      <p>Do not use Family Care to harass anyone, to message people who have not agreed, or to break the law. We may suspend accounts that do.</p>
      <h3>Our responsibility</h3>
      <p>We work hard to make it dependable, but we provide it as is, and our liability is limited to what you paid us in the last month, to the extent the law allows. WhatsApp and phone networks are outside our control.</p>
      <h3>Changes and contact</h3>
      <p>We may update these terms and will say so on this page. Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our <Link to="/privacy">Privacy</Link> page.</p>
    </Shell>
  );
}
