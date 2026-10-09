import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        bookTrain: 'Book Train',
        pnrEnquiry: 'PNR Enquiry',
        runningStatus: 'Running Status',
        touristTrains: 'Tourist Trains',
        meals: 'Meals & Catering',
        login: 'Login / Register',
      },
    },
    hi: {
      translation: {
        bookTrain: 'ट्रेन बुक करें',
        pnrEnquiry: 'पीएनआर पूछताछ',
        runningStatus: 'ट्रेन स्थिति',
        touristTrains: 'पर्यटक ट्रेनें',
        meals: 'भोजन और खानपान',
        login: 'लॉग इन / पंजीकरण',
      },
    },
  },
  lng: localStorage.getItem('quickrail-language') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;