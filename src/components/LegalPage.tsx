import { Link } from 'react-router-dom'
import { useLang, useTr } from '../i18n'

type LegalKind = 'privacy' | 'terms' | 'refund'

const updated = '3 October 2026'

const sections: Record<LegalKind, { title: string; intro: string; items: { heading: string; body: string }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains how KIFARO and AnatoMate handle account, learning, payment, and technical data.',
    items: [
      { heading: 'Information we collect', body: 'We may process your name, email, phone number, university, faculty, academic year, nationality, learning progress, purchases, device information, and technical error information when you use the service.' },
      { heading: 'How we use information', body: 'We use information to provide your account, personalize pricing and access, save learning progress, secure paid content, support payments, prevent abuse, improve reliability, and provide customer support.' },
      { heading: 'Payments', body: 'Payments are processed by Paymob or another displayed payment provider. KIFARO does not intentionally store complete payment-card numbers or card security codes.' },
      { heading: 'Protected educational content', body: 'Paid PDF and Datashow content may be personalized with the signed-in student name, account email, trace identifier, and viewing time to discourage unauthorized redistribution.' },
      { heading: 'Service providers', body: 'We use infrastructure and service providers such as Supabase, video hosting providers, payment processors, and platform providers only as needed to operate the service.' },
      { heading: 'Data retention', body: 'Account, purchase, learning, security, and support records may be retained while your account is active and for a reasonable period afterward where needed for legal, security, accounting, or service purposes.' },
      { heading: 'Your choices', body: 'You may contact KIFARO to request access, correction, or deletion of eligible personal information. Some transaction or security records may need to be retained where required by law or legitimate operational needs.' },
      { heading: 'Children', body: 'AnatoMate is intended for medical and health-sciences students and is not designed as a service directed to young children.' },
      { heading: 'Contact', body: 'Privacy and account questions can be sent to the support contact shown on kifaroedu.com.' },
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: 'These terms apply when you use KIFARO, AnatoMate, or related learning services.',
    items: [
      { heading: 'Educational purpose', body: 'AnatoMate provides educational material for students. It does not replace professional clinical judgment, formal university requirements, or patient-specific medical advice.' },
      { heading: 'Accounts', body: 'You are responsible for keeping your account credentials secure and for providing accurate registration information. Access is personal and may not be sold, shared, or transferred.' },
      { heading: 'Paid access', body: 'Purchasing a lecture or bundle grants the access described at checkout. Access types, view limits, prices, and included materials may differ by product and offer.' },
      { heading: 'Content protection', body: 'You may not copy, redistribute, record, scrape, bypass access controls, remove watermarks, or commercially reuse protected KIFARO or AnatoMate content without written permission.' },
      { heading: 'Availability', body: 'We aim to keep the service available but may perform maintenance, change hosting providers, update features, or temporarily suspend access where required for security or reliability.' },
      { heading: 'Academic responsibility', body: 'Course organization may support university study but students remain responsible for checking their official curriculum, exam instructions, and institutional requirements.' },
      { heading: 'Suspension', body: 'Accounts may be restricted for payment fraud, credential sharing, unauthorized redistribution, attempts to defeat content protection, or other material abuse of the service.' },
      { heading: 'Changes', body: 'We may update these terms when the service changes. The latest version published on KIFARO applies from its stated effective date.' },
    ],
  },
  refund: {
    title: 'Refund Policy',
    intro: 'This policy describes how refund requests for digital educational access are reviewed.',
    items: [
      { heading: 'Before purchase', body: 'Prices and the type of access being purchased are shown before payment. Please confirm the lecture, product type, and account before completing payment.' },
      { heading: 'Technical failures', body: 'If payment succeeds but the purchased content is not granted or cannot be accessed because of a verified KIFARO technical problem, we will first try to restore access. If the issue cannot reasonably be resolved, a refund may be approved.' },
      { heading: 'Duplicate charges', body: 'Verified duplicate charges for the same purchase are eligible for review and correction or refund.' },
      { heading: 'Digital content already accessed', body: 'Because access is to digital educational content, refunds are generally not provided simply because a student changes their mind after paid content has been successfully opened or used, except where applicable law requires otherwise.' },
      { heading: 'How to request a refund', body: 'Contact KIFARO support with the account email, lecture name, payment reference, payment date, and a short description of the issue. Do not send full card details.' },
      { heading: 'Processing', body: 'Approved refunds are returned through the available payment-provider process. Bank or card posting times are controlled by the payment provider and financial institution.' },
    ],
  },
}

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const content = sections[kind]
  const lang = useLang()
  const tr = useTr()
  return (
    <div className="page legalpage">
      {lang === 'ar' && (
        <div className="legallangnote">النص الرسمي لهذه السياسة باللغة الإنجليزية، ويُعرض كما هو.</div>
      )}
      {/* Legal text is English-only; keep it left-to-right so punctuation renders correctly in RTL mode. */}
      <div dir="ltr" lang="en">
      <div className="legalhero">
        <small>KIFARO · ANATOMATE</small>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
        <span>Last updated: {updated}</span>
      </div>

      <div className="legalcontent">
        {content.items.map((item) => (
          <section key={item.heading}>
            <h2>{item.heading}</h2>
            <p>{item.body}</p>
          </section>
        ))}
      </div>
      </div>

      <div className="legalnav">
        <Link to="/privacy">{tr('Privacy Policy', 'سياسة الخصوصية')}</Link>
        <Link to="/terms">{tr('Terms of Use', 'شروط الاستخدام')}</Link>
        <Link to="/refund">{tr('Refund Policy', 'سياسة الاسترداد')}</Link>
        <Link to="/">{tr('Back to KIFARO', 'العودة إلى KIFARO')}</Link>
      </div>
    </div>
  )
}
