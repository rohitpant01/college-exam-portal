# 🎓 PGI Exam & College Tutoring Portal

A modern, full-featured College Tutoring and Online Assessment Platform built with **React**, **Vite**, **Tailwind CSS**, and **Supabase** (100% Free tier).

---

## 🌟 Key Features

### 👨‍🏫 Admin / Tutor Panel
- **Comprehensive Analytics Dashboard**: Live metrics on total students, exams, published assessments, and notes library.
- **Subject Management**: Categorize study material and exams by branch, course, or subject.
- **Notes & Study Material Hub**:
  - Upload notes in PDF, Word, PowerPoint formats directly to Supabase Cloud Storage.
  - Automatic file size formatting, secure download links, and deletion.
- **MNC-Style Online Assessment Builder**:
  - Create timed MCQ exams with customizable pass marks, start/end scheduling windows, and durations.
  - **Single Question Builder**: Intuitive modal with option preview and marks assignment.
  - **Bulk Question Parser**: Paste an entire question paper in plain text (e.g. `Q: ... A) ... B) ... Answer: C Marks: 1`) and automatically generate multiple questions in one click!
  - Publish/Unpublish toggle with validation preventing empty exams.
- **Live Exam Results & Grading Analytics**:
  - Track student submissions, average scores, and pass rates.
  - Visual horizontal score distribution chart.
  - Detailed student-level breakdown with export capability.
- **Student Directory**: View all registered students, enrollment numbers, and assessment participation history.

### 👨‍🎓 Student Portal
- **Intuitive Student Dashboard**: Overview of enrolled subjects, available notes, exams completed, and average performance.
- **Study Notes Library**: Filter notes by subject or search by keyword with single-click PDF download.
- **Online Examination Engine (MNC Test Interface)**:
  - Pre-exam instruction screen with rules, total marks, and duration.
  - **Real-time Countdown Timer**: Persistent timer with warning color transition when under 5 minutes.
  - **Interactive Question Palette**: 5-column navigation with status indicators:
    - ⚪ *Not Visited*
    - 🔴 *Visited & Unanswered*
    - 🟢 *Answered*
    - 🟡 *Marked for Review*
    - 🟣 *Current Question*
  - **Question Controls**: Previous, Next, Clear Option, Mark for Review.
  - **Auto-save & Resume**: Automatically records progress and allows resumption if connection drops.
  - **Pre-submission Review Modal**: Alerts student if any questions remain unanswered.
  - **Auto-submit on Timeout**: Submits responses when the timer hits zero.
- **Instant Result & Performance Review**:
  - Score card showing total marks, percentage, and Pass/Fail badge.
  - Question-by-question review showing selected option vs correct option with detailed color coding.

---

## 🚀 Quick Setup Guide (Free Supabase Setup)

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in for free.
2. Click **"New Project"** and choose a name (e.g., `pgi-exam-portal`) and password.

### Step 2: Run Database Schema
1. In your Supabase Dashboard, navigate to the **SQL Editor** tab on the left sidebar.
2. Open the file `supabase-schema.sql` located in this project folder.
3. Copy its entire content, paste it into the Supabase SQL Editor, and click **RUN**.
   *(This creates all tables, Row Level Security policies, and the `notes` storage bucket).*

### Step 3: Configure Environment Variables
1. In Supabase Dashboard, go to **Project Settings** -> **API**.
2. Copy your **Project URL** and **anon / public key**.
3. Open the `.env` file in your project folder (`c:\PGI EXAM\.env`) and paste them:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key
   ```

### Step 4: Make Yourself an Admin
1. Start the app and register your tutor account at `/register`.
2. In Supabase Dashboard, go to **Table Editor** -> `profiles`.
3. Locate your email row and change the `role` from `'student'` to `'admin'`.
   *(Or run this quick SQL in the SQL Editor:)*
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your-tutor-email@example.com';
   ```
4. Log back in and you will be automatically routed to the **Admin Dashboard**!

---

## 💻 Running the Application

### Development Mode
```bash
npm run dev
```
Open your browser at `http://localhost:5173` to view the website.

### Production Build
```bash
npm run build
```
Generates an optimized bundle ready for free deployment to **Vercel**, **Netlify**, or **Cloudflare Pages**.

---

## 📁 Project Structure

```
PGI EXAM/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI & Layouts
│   │   ├── Layout/
│   │   │   ├── AdminLayout.jsx     # Admin sidebar navigation
│   │   │   └── StudentLayout.jsx   # Student portal navigation
│   │   └── ProtectedRoute.jsx      # Role-based route guard
│   ├── contexts/
│   │   └── AuthContext.jsx         # Supabase Auth provider
│   ├── lib/
│   │   └── supabase.js             # Supabase client singleton
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.jsx           # Clean responsive login
│   │   │   └── Register.jsx        # Student registration
│   │   ├── admin/                  # Admin portal views
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Subjects.jsx
│   │   │   ├── Notes.jsx
│   │   │   ├── Exams.jsx
│   │   │   ├── ExamQuestions.jsx   # Single + Bulk question parser
│   │   │   ├── Results.jsx
│   │   │   ├── ExamResults.jsx
│   │   │   └── Students.jsx
│   │   └── student/                # Student portal views
│   │       ├── Dashboard.jsx
│   │       ├── Notes.jsx
│   │       ├── ExamList.jsx
│   │       ├── TakeExam.jsx        # MNC assessment test interface
│   │       ├── MyResults.jsx
│   │       └── ExamResult.jsx      # Detailed post-exam review
│   ├── App.jsx                     # Master router configuration
│   ├── index.css                   # Tailwind CSS styling
│   └── main.jsx                    # Application root
├── supabase-schema.sql             # Complete database & RLS schema
├── package.json
└── vite.config.js
```
