export type UiLanguage = 'ENG' | 'हिन्दी';
const HI: Record<string, string> = {
  'TATKAL BOOKING OPENS:': 'तत्काल बुकिंग शुरू:', 'RailMadad Helpline:': 'रेल मदद हेल्पलाइन:',
  'Book Train': 'ट्रेन बुक करें', 'PNR Enquiry': 'पीएनआर पूछताछ', 'Running Status': 'चलती ट्रेन की स्थिति',
  'Tourist Trains': 'पर्यटक ट्रेनें', 'Meals & Catering': 'भोजन और खानपान',
  'QuickBid – Can you beat the AI?': 'क्विकबिड – क्या आप AI को हरा सकते हैं?', 'Login / Register': 'लॉगिन / रजिस्टर',
  'IRCTC Verified': 'IRCTC सत्यापित', 'My Bookings & PNRs': 'मेरी बुकिंग और पीएनआर',
  'Switch Account': 'खाता बदलें', 'Logout from IRCTC': 'IRCTC से लॉगआउट',
  'Ministry of Railways & IRCTC Official E-Ticketing System Integration': 'रेल मंत्रालय और IRCTC आधिकारिक ई-टिकटिंग सिस्टम एकीकरण',
  '256-Bit SSL Encrypted Banking': '256-बिट SSL एन्क्रिप्टेड बैंकिंग', 'Popular Routes': 'लोकप्रिय मार्ग',
  'Popular destinations': 'लोकप्रिय गंतव्य', 'Enter 10-Digit PNR Number': '10 अंकों का पीएनआर नंबर दर्ज करें',
  'Check PNR Status': 'पीएनआर स्थिति देखें', 'Enter Train Number (e.g. 12004) or Name': 'ट्रेन नंबर (जैसे 12004) या नाम दर्ज करें',
  'Type code, station or city': 'कोड, स्टेशन या शहर लिखें', 'Loading destinations…': 'गंतव्य लोड हो रहे हैं…',
  'Book Now': 'अभी बुक करें', 'Book Ticket': 'टिकट बुक करें', 'Book a Ticket': 'टिकट बुक करें',
  'Find Trains': 'ट्रेन खोजें', 'My Bookings': 'मेरी बुकिंग', 'RailWallet': 'रेलवॉलेट',
  'Meals': 'भोजन', 'Retiring Rooms': 'रिटायरिंग रूम', 'Features': 'सुविधाएँ', 'Learn more': 'और जानें',
  'View All': 'सभी देखें', 'View Details': 'विवरण देखें', 'Back': 'वापस', 'Continue': 'जारी रखें',
  'Next': 'आगे', 'Cancel': 'रद्द करें', 'Confirm': 'पुष्टि करें', 'Confirm & Pay': 'पुष्टि करें और भुगतान करें',
  'Pay Now': 'अभी भुगतान करें', 'Select': 'चुनें', 'Select Train': 'ट्रेन चुनें', 'Passengers': 'यात्री',
  'Passenger Details': 'यात्री विवरण', 'Payment': 'भुगतान', 'Payment Method': 'भुगतान का तरीका',
  'Fare Details': 'किराये का विवरण', 'Total Fare': 'कुल किराया', 'Booking Confirmed': 'बुकिंग की पुष्टि हो गई',
  'My Profile': 'मेरी प्रोफ़ाइल', 'Profile': 'प्रोफ़ाइल', 'Wallet': 'वॉलेट', 'Add Money': 'पैसे जोड़ें',
  'Top Up': 'रिचार्ज करें', 'Close': 'बंद करें', 'Sign in': 'साइन इन करें',
  'Sign in to book with Disha': 'दिशा से बुकिंग करने के लिए साइन इन करें',
  'Bookings, saved passengers and payments are tied to your QuickRail account.': 'बुकिंग, सहेजे गए यात्री और भुगतान आपके QuickRail खाते से जुड़े हैं।',
  'Your AI railway booking assistant · Drag header to move': 'आपकी AI रेलवे बुकिंग सहायक · खिसकाने के लिए हेडर खींचें',
  'Drag to move Disha': 'दिशा को खिसकाने के लिए खींचें',
  'Ask Disha how to use any QuickRail feature...': 'QuickRail की किसी भी सुविधा के बारे में दिशा से पूछें...',
  'Message Disha': 'दिशा को संदेश भेजें', 'Send message': 'संदेश भेजें', 'Start over': 'फिर से शुरू करें',
  'Start a new booking': 'नई बुकिंग शुरू करें', 'Guide me': 'मुझे मार्गदर्शन दें', 'How to book': 'बुकिंग कैसे करें',
  'Find trains': 'ट्रेन खोजें', 'PNR & status': 'पीएनआर और स्थिति', 'More features': 'अन्य सुविधाएँ',
  'Book now': 'अभी बुक करें',
  'Your session expired. Please sign in again.': 'आपका सत्र समाप्त हो गया है। कृपया फिर से साइन इन करें।',
  'Something went wrong. Please try again.': 'कुछ गलत हुआ। कृपया फिर से प्रयास करें।',
  'Could not place the food order.': 'खाने का ऑर्डर नहीं दिया जा सका।', 'English': 'अंग्रेज़ी', 'Hindi': 'हिंदी'
};
const EN: Record<string, string> = Object.fromEntries(Object.entries(HI).map(([english, hindi]) => [hindi, english]));
function translateValue(value: string, language: UiLanguage): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = (language === 'हिन्दी' ? HI : EN)[trimmed];
  if (!translated) return value;
  const start = value.indexOf(trimmed);
  return value.slice(0, start) + translated + value.slice(start + trimmed.length);
}
export function applyUiLanguage(root: HTMLElement, language: UiLanguage): () => void {
  const translateNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.parentElement && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
      const current = node.nodeValue || '';
      const next = translateValue(current, language);
      if (next !== current) node.nodeValue = next;
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      for (const attr of ['placeholder', 'aria-label', 'title', 'alt']) {
        const current = element.getAttribute(attr);
        if (current) { const next = translateValue(current, language); if (next !== current) element.setAttribute(attr, next); }
      }
      node.childNodes.forEach(translateNode);
    }
  };
  root.childNodes.forEach(translateNode);
  const observer = new MutationObserver((records) => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'characterData') translateNode(record.target);
      record.addedNodes.forEach(translateNode);
      if (record.type === 'attributes' && record.target instanceof HTMLElement) translateNode(record.target);
    }
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] });
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] });
  return () => observer.disconnect();
}
