import React, { useState } from 'react';

interface DishaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckPnr: (pnr: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'disha' | 'user';
  text: string;
  time: string;
  quickReplies?: string[];
}

export const DishaModal: React.FC<DishaModalProps> = ({ isOpen, onClose, onCheckPnr }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'disha',
      text: 'Namaste! I am Ask DISHA 2.0, your AI Railway Assistant. How can I assist with your train journey today?',
      time: 'Just now',
      quickReplies: [
        'Check PNR Status',
        'When does Tatkal open?',
        'Food & Catering rules',
        'Refund policy on Waitlist',
      ],
    },
  ]);
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const handleSend = (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userText,
      time: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // AI Responses
    setTimeout(() => {
      let botReply = '';
      const lower = userText.toLowerCase();

      if (lower.includes('tatkal')) {
        botReply =
          'AC Tatkal booking opens at 10:00 AM, and Non-AC (Sleeper) Tatkal booking opens at 11:00 AM, one day prior to the train departure date from origin.';
      } else if (lower.includes('pnr')) {
        botReply =
          'You can track your 10-digit PNR right here! Your latest confirmed booking is PNR 2419084321 on Train 12952 (Tejas Rajdhani) in Coach B4, Berth 32 (CNF).';
      } else if (lower.includes('food') || lower.includes('catering') || lower.includes('meal')) {
        botReply =
          'On Rajdhani and Vande Bharat trains, hot meals (Breakfast, Lunch, High Tea, Dinner) are served directly to your berth. You can also order Domino’s or Haldiram’s via e-Catering using your PNR!';
      } else if (lower.includes('refund') || lower.includes('cancel')) {
        botReply =
          'With Quick Rail Assured, you receive a 100% instant auto-refund to your RailWallet or UPI account within 15 minutes if your ticket is waitlisted at chart preparation or cancelled.';
      } else {
        botReply = `Regarding "${userText}": All IRCTC train schedules, seat quotas (GN, TQ, LD), and live running statuses are synchronised with CRIS servers. Would you like to check running status or book a seat?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'disha',
          text: botReply,
          time: 'Just now',
          quickReplies: ['Check PNR 2419084321', 'Tatkal Timing', 'View Menu'],
        },
      ]);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-margin">
      <div className="bg-white rounded-xl max-w-lg w-full h-[600px] flex flex-col shadow-2xl overflow-hidden border border-[#eff4ff]">
        {/* DISHA Header */}
        <div className="bg-[#001026] text-white p-space-md flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-full bg-[#ff8928] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-headline-sm text-headline-sm font-bold">Ask DISHA 2.0</h3>
                <span className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></span>
              </div>
              <p className="text-[11px] text-[#ffdcc6]">IRCTC Official Virtual Passenger Assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white cursor-pointer p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 p-space-md overflow-y-auto space-y-space-md bg-[#f8f9ff]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-space-sm text-[13px] leading-relaxed shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-[#001026] text-white rounded-br-none'
                    : 'bg-white text-[#0b1c30] border border-[#eff4ff] rounded-bl-none'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-[#74777f] mt-1 px-1">{m.time}</span>

              {m.quickReplies && m.quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.quickReplies.map((qr) => (
                    <button
                      key={qr}
                      type="button"
                      onClick={() => {
                        if (qr.includes('2419084321')) {
                          onCheckPnr('241-9084321');
                          onClose();
                        } else {
                          handleSend(qr);
                        }
                      }}
                      className="text-[11px] bg-[#e5eeff] hover:bg-[#dce9ff] text-[#001026] font-semibold px-2.5 py-1 rounded-full border border-[#d3e4fe] cursor-pointer transition-colors"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="p-space-sm bg-white border-t border-[#eff4ff]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-space-xs"
          >
            <input
              type="text"
              placeholder="Ask anything about trains, PNR, Tatkal, or meals..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-[#eff4ff] px-space-md py-2 rounded-lg text-[13px] text-[#001026] focus:outline-none focus:ring-1 focus:ring-[#ff8928]"
            />
            <button
              type="submit"
              className="w-10 h-10 rounded-lg bg-[#ff8928] hover:bg-[#964900] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
