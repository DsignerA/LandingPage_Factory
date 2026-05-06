
const ChatDemoSection = {
  props: {
    title: { type: String, default: 'Chat With Our Virtual Front Desk' },
    subtitle: { type: String, default: 'Friendly support when the office is busy or after hours — we can answer questions and collect appointment requests.' },
    messages: {
      type: Array,
      default: () => [
        { role: 'patient', text: 'Hi, do you accept Delta Dental PPO?' },
        { role: 'assistant', text: 'Yes — we accept most PPO plans including Delta Dental. I can also help you confirm benefits.' },
        { role: 'patient', text: 'Great! Do you have evening slots?' },
        { role: 'assistant', text: 'We have availability next Tuesday at 6pm. I can take your details to request that time now.' }
      ]
    }
  },
  computed: {
    normalizedMessages() {
      const arr = Array.isArray(this.messages) ? this.messages : []
      return arr
        .map((m) => {
          const role = (m && typeof m.role === 'string') ? m.role.toLowerCase().trim() : ''
          const text = (m && typeof m.text === 'string') ? m.text.trim() : ''
          return { role: role === 'assistant' ? 'assistant' : 'patient', text }
        })
        .filter(m => m.text)
    }
  },
  template: `
<section class="py-20 px-6">
  <div class="max-w-3xl mx-auto">
    <div class="text-center mb-8">
      <h2 class="text-3xl md:text-4xl font-bold mb-3">{{ title }}</h2>
      <p v-if="subtitle" class="text-zinc-600 max-w-2xl mx-auto">{{ subtitle }}</p>
    </div>

    <div class="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
      <!-- Chat header -->
      <div class="bg-blue-600 text-white px-5 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold" aria-hidden="true">VF</div>
          <div>
            <div class="font-semibold">Virtual Front Desk</div>
            <div class="text-xs text-blue-100">Typically replies in minutes • Available after hours</div>
          </div>
        </div>
        <div class="text-xs text-blue-100">Dental practice chat</div>
      </div>

      <!-- Chat transcript -->
      <div class="p-5 bg-zinc-50">
        <div class="space-y-3 max-h-80 overflow-auto pr-1">
          <div v-for="(m, i) in normalizedMessages" :key="i" class="flex" :class="m.role === 'patient' ? 'justify-start' : 'justify-end'">
            <div :class="[
              'max-w-[85%] md:max-w-[70%] px-4 py-3 text-[15px] leading-6 rounded-2xl shadow-sm',
              m.role === 'patient' ? 'bg-white text-zinc-800 border border-zinc-200 rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'
            ]">
              {{ m.text }}
            </div>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="pt-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="text-sm px-3 py-2 rounded-full border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50">Insurance Questions</button>
            <button type="button" class="text-sm px-3 py-2 rounded-full border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50">Request Appointment</button>
            <button type="button" class="text-sm px-3 py-2 rounded-full border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50">Office Hours</button>
          </div>
        </div>

        <!-- Input (static demo) -->
        <div class="mt-4 border-t border-zinc-200 pt-4">
          <div class="flex items-center gap-2">
            <input type="text" disabled class="flex-1 bg-zinc-100 text-zinc-500 text-sm rounded-lg px-3 py-2" placeholder="Type your question (demo)" aria-label="Chat input disabled (demo)" />
            <button type="button" disabled class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm opacity-60 cursor-not-allowed">Send</button>
          </div>
          <div class="text-xs text-zinc-500 mt-2">Demo: When the office is busy or closed, the virtual front desk can answer common questions and collect appointment requests.</div>
        </div>
      </div>
    </div>
  </div>
</section>
`
}
if (typeof window !== 'undefined') window.ChatDemoSection = ChatDemoSection;
