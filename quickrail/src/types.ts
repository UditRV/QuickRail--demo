export type ScreenType = 'home' | 'results' | 'passenger' | 'payment' | 'confirmed' | 'bookings' | 'login'| 'quickbid';

export interface UserProfile {
  id: string;
  name: string;
  irctcUsername: string;
  email: string;
  mobile: string;
  isAadhaarVerified: boolean;
  aadhaarNumber?: string;
  city?: string;
  state?: string;
  pincode?: string;
  occupation?: string;
  walletBalance: number;
  isLoggedIn: boolean;
}

export interface PaymentDetails {
  method: 'upi' | 'card' | 'netbanking' | 'wallet' | 'epaylater';
  upiId?: string;
  cardNumber?: string;
  cardBank?: string;
  bankName?: string;
  walletName?: string;
  amount: number;
  convenienceFee: number;
  gstAmount: number;
  netPayable: number;
  transactionId: string;
  bankRefNumber: string;
  paidAt: string;
}

export interface Passenger {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Transgender';
  berthPreference: 'No Preference' | 'Lower (LB)' | 'Middle (MB)' | 'Upper (UB)' | 'Side Lower (SL)' | 'Side Upper (SU)';
  mealOption: 'Veg (Standard)' | 'Non-Veg (Egg/Chicken)' | 'Jain Meal' | 'No Food (-₹325)';
  isSeniorCitizenQuota: boolean;
  isChildWithoutBerth?: boolean;
}

export interface CoachClass {
  classCode: string;
  name: string;
  price: number;
  status: string;
  statusType: 'available' | 'rac' | 'waitlist' | 'not_running';
  subtext?: string;
  availableCount?: number;
}

export interface TrainSchedule {
  stationCode: string;
  stationName: string;
  time: string;
  day: string;
  platform: string;
  haltDuration?: string;
  distanceCovered?: string;
  detail?: string;
}

export interface Train {
  number: string;
  name: string;
  badge: string;
  typeText: string;
  fromStationCode: string;
  fromStationName: string;
  departureTime: string;
  departurePlatform: string;
  departureDay: string;
  toStationCode: string;
  toStationName: string;
  arrivalTime: string;
  arrivalPlatform: string;
  arrivalDay: string;
  duration: string;
  routeHighlight: string;
  stopsCount: number;
  intermediateStops: string[];
  features: string[];
  classes: CoachClass[];
  selectedClassCode: string;
  operatingDays: string;
}

export interface BookingState {
  fromStation: string;
  toStation: string;
  journeyDate: string;
  quota: string;
  selectedTrain: Train;
  selectedClass: CoachClass;
  passengers: Passenger[];
  contactMobile: string;
  contactEmail: string;
  autoUpgradation: boolean;
  bookOnlyIfConfirm: boolean;
  preferredCoach: string;
  quickRailAssured: boolean;
  travelInsurance: boolean;
  pnr: string;
  transactionId: string;
  bookingTime: string;
  totalAmount?: number;
  paymentDetails?: PaymentDetails;
}
