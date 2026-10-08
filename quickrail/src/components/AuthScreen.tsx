import React, { useState } from 'react';
import { UserProfile } from '../types';
import { QUICK_RAIL_LOGO } from '../data/mockData';
import { apiLogin, apiRegister, setToken, ApiError } from '../services/api';

interface AuthScreenProps {
  currentUser: UserProfile;
  onLoginSuccess: (user: UserProfile) => void;
  onCancel: () => void;
  initialMode?: 'signin' | 'register';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentUser,
  onLoginSuccess,
  onCancel,
  initialMode = 'signin',
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'register'>(initialMode);

  // SIGN IN STATE
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [username, setUsername] = useState('rahul_sharma_irctc');
  const [password, setPassword] = useState('Train@2024');
  const [showPassword, setShowPassword] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('9876543210');
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState('7K9mX');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // REGISTRATION STATE (Multi-step)
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [regUsername, setRegUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLanguage, setRegLanguage] = useState<'English' | 'Hindi'>('English');
  const [regSecurityQ, setRegSecurityQ] = useState('What was your childhood pet name?');
  const [regSecurityA, setRegSecurityA] = useState('');

  // Step 2
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regOccupation, setRegOccupation] = useState('PRIVATE');
  const [regDob, setRegDob] = useState('1994-05-18');
  const [regMarital, setRegMarital] = useState<'Married' | 'Unmarried'>('Unmarried');
  const [regGender, setRegGender] = useState<'Male' | 'Female' | 'Transgender'>('Male');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regNationality, setRegNationality] = useState('Indian');

  // Step 3
  const [regAddress, setRegAddress] = useState('');
  const [regStreet, setRegStreet] = useState('');
  const [regPincode, setRegPincode] = useState('110001');
  const [regState, setRegState] = useState('Delhi');
  const [regCity, setRegCity] = useState('New Delhi');
  const [regPostOffice, setRegPostOffice] = useState('Connaught Place S.O');
  const [regAadhaar, setRegAadhaar] = useState('');
  const [regTermsAccepted, setRegTermsAccepted] = useState(false);

  // Helper to generate a new captcha
  const refreshCaptcha = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setCaptchaInput('');
  };

  // Audio speech synthesis for Captcha
  const playCaptchaAudio = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(captchaCode.split('').join(' '));
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Check username availability simulation
  const checkUsernameAvailability = (uname: string) => {
    setRegUsername(uname);
    if (uname.length >= 4) {
      // Simulate CRIS check
      const taken = ['admin', 'irctc', 'test', 'user', 'guest'].includes(uname.toLowerCase());
      setUsernameAvailable(!taken);
    } else {
      setUsernameAvailable(null);
    }
  };

  // Handle Pincode Auto-lookup
  const handlePincodeChange = (pin: string) => {
    const cleaned = pin.replace(/\D/g, '').slice(0, 6);
    setRegPincode(cleaned);
    if (cleaned === '110001') {
      setRegState('Delhi');
      setRegCity('Central Delhi');
      setRegPostOffice('Connaught Place S.O');
    } else if (cleaned === '400001') {
      setRegState('Maharashtra');
      setRegCity('Mumbai');
      setRegPostOffice('Mumbai G.P.O.');
    } else if (cleaned === '560001') {
      setRegState('Karnataka');
      setRegCity('Bengaluru');
      setRegPostOffice('Bangalore G.P.O.');
    } else if (cleaned.length === 6) {
      setRegState('Delhi');
      setRegCity('New Delhi');
      setRegPostOffice('Main Head Post Office');
    }
  };

  // Quick Demo User Filler
  const fillDemoUser = (type: 'rahul' | 'priya') => {
    if (type === 'rahul') {
      setUsername('rahul_sharma_irctc');
      setPassword('Train@2024');
      setMobileNumber('9876543210');
      setCaptchaInput(captchaCode);
    } else {
      setUsername('priya_rail_rider');
      setPassword('Tatkal#2024');
      setMobileNumber('9811223344');
      setCaptchaInput(captchaCode);
    }
  };

  // Handle Login Submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (loginMethod === 'password') {
      if (!username.trim()) {
        setAuthError('Please enter valid IRCTC User ID.');
        return;
      }
      if (!password) {
        setAuthError('Please enter your password.');
        return;
      }
      if (captchaInput.toLowerCase() !== captchaCode.toLowerCase()) {
        setAuthError('Captcha entered does not match. Please try again.');
        refreshCaptcha();
        return;
      }
    } else {
      if (!otpSent) {
        if (mobileNumber.length < 10) {
          setAuthError('Please enter a valid 10-digit registered mobile number.');
          return;
        }
        setOtpSent(true);
        setEnteredOtp('492018'); // prefill for easy testing
        setAuthSuccess('One Time Password (OTP) 492018 sent via SMS to registered mobile.');
        return;
      } else {
        if (enteredOtp.length !== 6) {
          setAuthError('Please enter the 6-digit OTP received on mobile.');
          return;
        }
      }
    }

    if (loginMethod === 'otp') {
      // OTP-based sign-in is a UI simulation only — the backend authenticates by
      // username/mobile + password. Route OTP sign-ins through the same real
      // login call using the password field the user set at registration is not
      // available here, so we surface a clear message instead of faking success.
      setAuthError('OTP sign-in is a demo flow in this build — please use User ID & Password to sign in for real.');
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        const { token, user } = await apiLogin(username.trim(), password);
        setToken(token);
        const loggedInUser: UserProfile = {
          id: user.id,
          name: user.name,
          irctcUsername: user.irctcUsername,
          email: user.email,
          mobile: user.mobile,
          isAadhaarVerified: user.isAadhaarVerified,
          city: user.city,
          state: user.state,
          pincode: user.pincode,
          occupation: user.occupation,
          walletBalance: user.walletBalance,
          isLoggedIn: true,
        };
        onLoginSuccess(loggedInUser);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Unable to reach QuickRail servers. Please try again.';
        setAuthError(message);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  // Handle Register Step Transitions
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (regStep === 1) {
      if (!regUsername || regUsername.length < 4) {
        setAuthError('IRCTC User ID must be at least 4 characters.');
        return;
      }
      if (usernameAvailable === false) {
        setAuthError('Selected User ID is already taken. Please choose another.');
        return;
      }
      if (!regPassword || regPassword.length < 8) {
        setAuthError('Password must be at least 8 characters long.');
        return;
      }
      if (regPassword !== regConfirmPassword) {
        setAuthError('Password and Confirm Password do not match.');
        return;
      }
      if (!regSecurityA.trim()) {
        setAuthError('Please provide an answer to the Security Question for account recovery.');
        return;
      }
      setRegStep(2);
    } else if (regStep === 2) {
      if (!regFirstName.trim()) {
        setAuthError('Please enter First Name.');
        return;
      }
      if (!regEmail.includes('@') || !regEmail.includes('.')) {
        setAuthError('Please enter a valid Email ID.');
        return;
      }
      if (regMobile.replace(/\D/g, '').length < 10) {
        setAuthError('Please enter a valid 10-digit mobile number.');
        return;
      }
      setRegStep(3);
    } else if (regStep === 3) {
      if (!regAddress.trim()) {
        setAuthError('Please enter flat/door/block address.');
        return;
      }
      if (regPincode.length !== 6) {
        setAuthError('Please enter a valid 6-digit Pincode.');
        return;
      }
      if (!regTermsAccepted) {
        setAuthError('You must agree to IRCTC Terms of Service to register.');
        return;
      }

      // Complete Registration — create a real account on the backend
      setIsLoading(true);
      (async () => {
        try {
          const { token, user } = await apiRegister({
            name: `${regFirstName} ${regLastName}`.trim(),
            email: regEmail,
            mobile: regMobile,
            password: regPassword,
            irctcUsername: regUsername,
          });
          setToken(token);
          const newUser: UserProfile = {
            id: user.id,
            name: user.name,
            irctcUsername: user.irctcUsername,
            email: user.email,
            mobile: user.mobile,
            isAadhaarVerified: user.isAadhaarVerified,
            city: regCity,
            state: regState,
            pincode: regPincode,
            occupation: user.occupation,
            walletBalance: user.walletBalance,
            isLoggedIn: true,
          };
          onLoginSuccess(newUser);
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Unable to reach QuickRail servers. Please try again.';
          setAuthError(message);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  };

  return (
    <div className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop py-space-md mb-space-xl">
      {/* Top CRIS Security Header */}
      <div className="bg-[#001026] text-white rounded-xl p-space-md mb-space-md shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md border border-[#0b2545]">
        <div className="flex items-center gap-space-md">
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <span className="material-symbols-outlined text-[28px] text-[#ff8928]">verified_user</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline-md text-headline-md font-bold">IRCTC Individual User Portal</h1>
              <span className="bg-[#ff8928] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                CRIS Authenticated
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-[#cbdbf5] mt-0.5">
              Secure single sign-on for Indian Railways train reservation, Tatkal quotas, e-Catering &amp; RailWallet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-sm bg-white/10 px-space-md py-1.5 rounded-lg border border-white/15 text-[11px]">
          <span className="material-symbols-outlined text-[16px] text-green-400">lock</span>
          <span>256-Bit SSL Encrypted Session</span>
          <span className="text-[#ffdcc6] font-data-mono">● LIVE</span>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-[#eff4ff] overflow-hidden">
        {/* Navigation Tabs (Sign In vs Register) */}
        <div className="grid grid-cols-2 border-b border-[#eff4ff] bg-[#f8f9ff]">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`py-space-md text-center font-headline-sm text-headline-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'signin'
                ? 'bg-white text-[#001026] border-b-2 border-[#ff8928] shadow-xs'
                : 'text-[#74777f] hover:text-[#001026] hover:bg-[#eff4ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
            <span>Sign In to IRCTC</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`py-space-md text-center font-headline-sm text-headline-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'register'
                ? 'bg-white text-[#001026] border-b-2 border-[#ff8928] shadow-xs'
                : 'text-[#74777f] hover:text-[#001026] hover:bg-[#eff4ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>Register New Account</span>
          </button>
        </div>

        {/* Global Error / Success Messages */}
        {authError && (
          <div className="m-space-md p-space-sm bg-red-50 border border-red-200 text-red-700 rounded-lg text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div className="m-space-md p-space-sm bg-green-50 border border-green-200 text-green-800 rounded-lg text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{authSuccess}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* 1. SIGN IN SCREEN CONTENT */}
        {/* ========================================================= */}
        {authMode === 'signin' && (
          <div className="p-space-lg">
            {/* Quick Demo Credentials Bar */}
            <div className="mb-space-md bg-[#eff4ff] p-space-sm rounded-xl border border-[#d3e4fe] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12px] text-[#0b1c30]">
                <span className="material-symbols-outlined text-[#ff8928] text-[18px]">lightbulb</span>
                <span className="font-semibold">Demo Accounts:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoUser('rahul')}
                  className="px-2.5 py-1 bg-white hover:bg-[#dce9ff] text-[#001026] text-[11px] font-bold rounded shadow-xs border border-[#d3e4fe] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Rahul Sharma</span>
                  <span className="bg-green-100 text-green-800 text-[9px] px-1 rounded">Aadhaar Linked</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoUser('priya')}
                  className="px-2.5 py-1 bg-white hover:bg-[#dce9ff] text-[#001026] text-[11px] font-bold rounded shadow-xs border border-[#d3e4fe] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Priya Verma</span>
                  <span className="bg-[#ff8928]/15 text-[#964900] text-[9px] px-1 rounded">Tatkal Fast</span>
                </button>
              </div>
            </div>

            {/* Login Method Toggle (Password vs OTP) */}
            <div className="flex items-center gap-2 mb-space-md p-1 bg-[#eff4ff] rounded-lg max-w-sm">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('password');
                  setAuthError('');
                }}
                className={`flex-1 py-1.5 rounded-md text-[12px] font-bold transition-all cursor-pointer ${
                  loginMethod === 'password'
                    ? 'bg-white text-[#001026] shadow-xs'
                    : 'text-[#44474e] hover:text-[#001026]'
                }`}
              >
                User ID &amp; Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('otp');
                  setAuthError('');
                }}
                className={`flex-1 py-1.5 rounded-md text-[12px] font-bold transition-all cursor-pointer ${
                  loginMethod === 'otp'
                    ? 'bg-white text-[#001026] shadow-xs'
                    : 'text-[#44474e] hover:text-[#001026]'
                }`}
              >
                Login with OTP
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-space-md">
              {loginMethod === 'password' ? (
                <>
                  {/* User Name */}
                  <div>
                    <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                      IRCTC User Name / ID
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#74777f] text-[20px]">
                        account_circle
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter IRCTC User ID"
                        className="w-full bg-[#f8f9ff] pl-10 pr-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-label-md text-label-md font-bold text-[#001026]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => alert('Password reset link sent to registered email & mobile.')}
                        className="text-[11px] text-[#964900] hover:underline font-semibold cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#74777f] text-[20px]">
                        lock
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your IRCTC password"
                        className="w-full bg-[#f8f9ff] pl-10 pr-10 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-[#74777f] hover:text-[#001026] cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* CAPTCHA CHALLENGE */}
                  <div className="bg-[#eff4ff]/60 p-space-md rounded-xl border border-[#d3e4fe]">
                    <span className="font-label-sm text-[11px] uppercase font-bold text-[#44474e] block mb-2">
                      IRCTC Security Captcha Verification
                    </span>
                    <div className="flex flex-col sm:flex-row items-center gap-space-md">
                      {/* Textured Graphic Captcha Box */}
                      <div className="h-12 px-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-300 rounded-lg border-2 border-gray-400 flex items-center justify-center gap-1 select-none relative overflow-hidden shadow-inner">
                        {/* Security lines overlay */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]"></div>
                        <div className="absolute w-full h-[1px] bg-red-400 top-3 opacity-40 transform -rotate-6"></div>
                        <div className="absolute w-full h-[1px] bg-blue-500 bottom-3 opacity-40 transform rotate-3"></div>

                        <span className="font-data-mono font-bold text-[22px] tracking-[6px] text-gray-800 italic transform skew-x-6 drop-shadow-sm">
                          {captchaCode}
                        </span>
                      </div>

                      {/* Captcha Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={refreshCaptcha}
                          className="w-10 h-10 rounded-lg bg-white hover:bg-[#dce9ff] text-[#001026] border border-[#d3e4fe] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          title="Refresh Captcha"
                        >
                          <span className="material-symbols-outlined text-[20px]">refresh</span>
                        </button>
                        <button
                          type="button"
                          onClick={playCaptchaAudio}
                          className="w-10 h-10 rounded-lg bg-white hover:bg-[#dce9ff] text-[#001026] border border-[#d3e4fe] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          title="Audio Captcha (Speech)"
                        >
                          <span className="material-symbols-outlined text-[20px]">volume_up</span>
                        </button>
                      </div>

                      {/* Captcha Input */}
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          value={captchaInput}
                          onChange={(e) => setCaptchaInput(e.target.value)}
                          placeholder="Enter Captcha text"
                          className="w-full bg-white px-space-md py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono font-bold text-[15px] text-[#001026] uppercase focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Login with Mobile & OTP */}
                  <div>
                    <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                      Registered Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <div className="flex items-center bg-[#f8f9ff] px-3 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[#44474e] text-[14px]">
                        +91
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 10-digit mobile"
                        className="flex-1 bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (mobileNumber.length < 10) {
                            setAuthError('Enter 10-digit mobile number first.');
                            return;
                          }
                          setOtpSent(true);
                          setEnteredOtp('492018');
                          setAuthSuccess('OTP 492018 sent to +91 ' + mobileNumber);
                        }}
                        className="px-space-md py-2.5 bg-[#001026] hover:bg-[#0b2545] text-white font-bold rounded-lg text-[13px] cursor-pointer"
                      >
                        {otpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                    </div>
                  </div>

                  {otpSent && (
                    <div className="bg-[#eff4ff] p-space-md rounded-xl border border-[#d3e4fe]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-label-md text-label-md font-bold text-[#001026]">
                          Enter 6-Digit OTP
                        </label>
                        <span className="text-[11px] text-green-700 font-bold">Auto-filled: 492018</span>
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={enteredOtp}
                        onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="6-digit OTP"
                        className="w-full bg-white px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono font-bold text-center tracking-[8px] text-[18px] text-[#001026] focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-[13px]">
                <label className="flex items-center gap-2 text-[#44474e] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#ff8928] focus:ring-[#ff8928] cursor-pointer"
                  />
                  <span>Save session for 1-Click Fast Tatkal Checkout</span>
                </label>

                <button
                  type="button"
                  onClick={() => alert('Your registered IRCTC User ID has been sent to your email.')}
                  className="text-[#964900] text-[12px] hover:underline font-semibold cursor-pointer"
                >
                  Forgot User ID?
                </button>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#001026] hover:bg-[#0b2545] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Authenticating with CRIS Servers...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">lock_open</span>
                    <span>LOG IN TO IRCTC</span>
                  </>
                )}
              </button>

              {/* Bottom Notice */}
              <div className="text-center pt-2">
                <span className="text-[12px] text-[#74777f]">
                  Don&apos;t have an IRCTC account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className="text-[#964900] font-bold hover:underline cursor-pointer"
                  >
                    Register free in 2 minutes
                  </button>
                </span>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. REGISTER SCREEN CONTENT (Multi-step) */}
        {/* ========================================================= */}
        {authMode === 'register' && (
          <div className="p-space-lg">
            {/* Step Progress Tracker */}
            <div className="mb-space-lg">
              <div className="flex items-center justify-between mb-2 text-[12px] font-bold">
                <span className={regStep >= 1 ? 'text-[#ff8928]' : 'text-[#74777f]'}>
                  1. Basic Details
                </span>
                <span className={regStep >= 2 ? 'text-[#ff8928]' : 'text-[#74777f]'}>
                  2. Personal Details
                </span>
                <span className={regStep >= 3 ? 'text-[#ff8928]' : 'text-[#74777f]'}>
                  3. Address &amp; Aadhaar
                </span>
              </div>
              <div className="w-full h-2 bg-[#eff4ff] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff8928] transition-all duration-300 rounded-full"
                  style={{ width: `${(regStep / 3) * 100}%` }}
                ></div>
              </div>
            </div>

            <form onSubmit={handleNextStep} className="space-y-space-md">
              {/* STEP 1: BASIC DETAILS */}
              {regStep === 1 && (
                <div className="space-y-space-md">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#001026] text-white text-[12px] flex items-center justify-center">
                      1
                    </span>
                    <span>Account Credentials &amp; Security</span>
                  </h3>

                  {/* Username with Live Check */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-label-md text-label-md font-bold text-[#001026]">
                        User Name (4 to 35 characters)
                      </label>
                      {usernameAvailable === true && (
                        <span className="text-[11px] text-green-700 font-bold flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          Username Available!
                        </span>
                      )}
                      {usernameAvailable === false && (
                        <span className="text-[11px] text-red-600 font-bold flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                          Username already taken
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => checkUsernameAvailability(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. suresh_railways"
                      className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                    />
                    <span className="text-[11px] text-[#74777f] mt-1 block">
                      Only letters, numbers, and underscores allowed.
                    </span>
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Re-type password"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                  </div>

                  {/* Preferred Language & Security Question */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Preferred Language
                      </label>
                      <select
                        value={regLanguage}
                        onChange={(e) => setRegLanguage(e.target.value as 'English' | 'Hindi')}
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] text-[#001026] focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">हिन्दी (Hindi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Security Question
                      </label>
                      <select
                        value={regSecurityQ}
                        onChange={(e) => setRegSecurityQ(e.target.value)}
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] text-[#001026] focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      >
                        <option value="What was your childhood pet name?">What was your childhood pet name?</option>
                        <option value="What was the name of your first school?">What was the name of your first school?</option>
                        <option value="What is your all-time favorite holiday destination?">What is your all-time favorite holiday destination?</option>
                        <option value="What was your first car or bike model?">What was your first car or bike model?</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                      Security Answer (for password reset)
                    </label>
                    <input
                      type="text"
                      value={regSecurityA}
                      onChange={(e) => setRegSecurityA(e.target.value)}
                      placeholder="e.g. Bruno"
                      className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: PERSONAL DETAILS */}
              {regStep === 2 && (
                <div className="space-y-space-md">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#001026] text-white text-[12px] flex items-center justify-center">
                      2
                    </span>
                    <span>Passenger Personal Details</span>
                  </h3>

                  {/* Names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        placeholder="e.g. Ramesh"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                        placeholder="e.g. Kumar"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                  </div>

                  {/* Occupation & DOB */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Occupation
                      </label>
                      <select
                        value={regOccupation}
                        onChange={(e) => setRegOccupation(e.target.value)}
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] text-[#001026] focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      >
                        <option value="GOVERNMENT">Government / PSU</option>
                        <option value="PUBLIC">Public Sector</option>
                        <option value="PRIVATE">Private Sector</option>
                        <option value="PROFESSIONAL">Professional (Doctor, Lawyer, CA)</option>
                        <option value="SELF EMPLOYED">Self Employed / Business</option>
                        <option value="STUDENT">Student</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={regDob}
                        onChange={(e) => setRegDob(e.target.value)}
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] text-[#001026] focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                  </div>

                  {/* Gender & Marital Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Gender
                      </label>
                      <div className="flex gap-2">
                        {(['Male', 'Female', 'Transgender'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setRegGender(g)}
                            className={`flex-1 py-2 text-[12px] font-bold rounded-lg border cursor-pointer ${
                              regGender === g
                                ? 'bg-[#001026] text-white border-[#001026]'
                                : 'bg-[#f8f9ff] text-[#44474e] border-[#d3e4fe]'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Marital Status
                      </label>
                      <div className="flex gap-2">
                        {(['Married', 'Unmarried'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setRegMarital(m)}
                            className={`flex-1 py-2 text-[12px] font-bold rounded-lg border cursor-pointer ${
                              regMarital === m
                                ? 'bg-[#001026] text-white border-[#001026]'
                                : 'bg-[#f8f9ff] text-[#44474e] border-[#d3e4fe]'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Email & Mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="e.g. ramesh@example.com"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Mobile Number *
                      </label>
                      <div className="flex gap-2">
                        <span className="bg-[#eff4ff] px-3 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] font-bold text-[#44474e]">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={regMobile}
                          onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ''))}
                          placeholder="10-digit mobile"
                          className="flex-1 bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: ADDRESS & AADHAAR */}
              {regStep === 3 && (
                <div className="space-y-space-md">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#001026] text-white text-[12px] flex items-center justify-center">
                      3
                    </span>
                    <span>Residential Address &amp; Aadhaar e-KYC</span>
                  </h3>

                  {/* Aadhaar e-KYC Spotlight Card */}
                  <div className="bg-gradient-to-r from-[#ffdcc6]/60 to-[#ffe8d9]/60 p-space-md rounded-xl border border-[#ff8928]/40">
                    <div className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-[#964900] text-[24px]">fingerprint</span>
                      <div>
                        <h4 className="font-label-md text-label-md font-bold text-[#001026]">
                          Link Aadhaar for 24 Tickets per Month Quota
                        </h4>
                        <p className="font-body-sm text-[12px] text-[#44474e] mt-0.5">
                          Non-Aadhaar accounts are capped at 12 tickets/month. Linking Aadhaar unlocks 24 tickets &amp; faster Tatkal booking!
                        </p>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            maxLength={12}
                            value={regAadhaar}
                            onChange={(e) => setRegAadhaar(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 12-digit Aadhaar Number (Optional)"
                            className="bg-white px-3 py-1.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[13px] text-[#001026] focus:outline-none w-64"
                          />
                          <span className="text-[11px] text-green-700 font-bold self-center">
                            {regAadhaar.length === 12 ? '✓ Instant e-KYC Ready' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flat / Door / Street */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Flat / Door / Block No. *
                      </label>
                      <input
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="e.g. Flat 402, Royal Residency"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Street / Lane / Area
                      </label>
                      <input
                        type="text"
                        value={regStreet}
                        onChange={(e) => setRegStreet(e.target.value)}
                        placeholder="e.g. MG Road, Sector 14"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>
                  </div>

                  {/* Pincode & City/State */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Pincode *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={regPincode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        placeholder="6-digit Pincode"
                        className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                      />
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={regState}
                        readOnly
                        className="w-full bg-[#eff4ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] text-[#001026] cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        City / District
                      </label>
                      <input
                        type="text"
                        value={regCity}
                        readOnly
                        className="w-full bg-[#eff4ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] text-[#001026] cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Terms & Conditions Checkbox */}
                  <div className="pt-space-sm">
                    <label className="flex items-start gap-2 text-[12px] text-[#44474e] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={regTermsAccepted}
                        onChange={(e) => setRegTermsAccepted(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-[#ff8928] focus:ring-[#ff8928] cursor-pointer"
                      />
                      <span>
                        I have read and agree with the <strong>IRCTC Terms and Conditions</strong> and CRIS Fair Usage Policy.
                        I understand creating multiple fake accounts is punishable under the Indian Railways Act.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-space-md border-t border-[#eff4ff]">
                {regStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setRegStep((prev) => (prev - 1) as 1 | 2)}
                    className="px-space-md py-2 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] font-bold rounded-lg text-[13px] cursor-pointer"
                  >
                    Back
                  </button>
                ) : (
                  <div></div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-space-xl py-3 bg-[#ff8928] hover:bg-[#964900] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Registering with CRIS...</span>
                    </>
                  ) : regStep < 3 ? (
                    <>
                      <span>Continue to Step {regStep + 1}</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                      <span>COMPLETE REGISTRATION</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Security Advisory Footer */}
      <div className="max-w-3xl mx-auto mt-space-md text-center">
        <p className="text-[11px] text-[#74777f] flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-[#ff8928]">security</span>
          IRCTC or Quick Rail will NEVER ask for your password, debit/credit card CVV, or OTP via phone call or SMS.
        </p>
      </div>
    </div>
  );
};
