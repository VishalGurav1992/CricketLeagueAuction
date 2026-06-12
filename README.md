# CricketLeagueAuction
# Cricket League Auction System

A comprehensive, interactive auction management system designed specifically for cricket league team selections. This application automates the bidding process, manages player selections, and tracks team finances in real-time.

## Overview

This is a standalone cricket league auction application built with **Node.js** backend and **React** frontend. The system is designed for live auction management with support for both an auctioneer panel and a public dashboard display.

---

## 🎯 Key Features

### 1. **Undo Functionality**
   - Revert the last sold or unsold player transaction
   - Restores player to available pool and team budget to previous state
   - Single-click undo for mistake correction

### 2. **Smart Player Organization**
   - **Dropdown Serial Numbers**: Each player displays a unique serial number for easy reference
   - **Team Players List Enhancement**: Shows sequence numbers instead of jersey numbers for clarity
   - Improved player identification in live auctions

### 3. **Intelligent Relist Auctions**
   - Players can be re-auctioned after being released
   - **Conflict Prevention**: The team that released the player cannot bid on them in the relist
   - Ensures fair and ethical bidding practices

### 4. **Optimized Player Auction Order**
   - Auction sequence follows this priority:
     1. Main auction players
     2. Relist players
     3. Unsold players
   - Streamlines auction flow and manages time effectively

### 5. **Pre-configured Team Budgets**
   - Teams start with adjusted budgets reflecting early deductions
   - **Pre-deducted Amount**: ₹15,000
   - Applicable to:
     - SIDDARAMESHWAR
     - MUDGA GAME CHANGERS
   - Ensures fair budget allocation

### 6. **Quick Bid Increment Button**
   - **+1000 Rupees Button**: Rapidly increase bids during competitive bidding
   - Speeds up auction proceedings for high-demand players
   - One-click increment for smooth flow

### 7. **Enhanced Display Screen**
   - **Top Section**: Live team standings with current budgets and player counts
   - **Bottom Left**: Player photograph (uncroped, occupies 50% of width) for visual identification
   - **Bottom Right**: Player details panel showing:
     - Player role (Batsman, Bowler, All-rounder, etc.)
     - Area/region
     - Age
     - Current bid amount
   - Real-time visual feedback for audience

### 8. **Audio Notifications**
   - **Sound Effects**: Distinct sounds for player sold and unsold events
   - Enhances live auction atmosphere
   - Provides immediate auditory feedback to all participants
   - Configurable sound settings (see `public/sound-config.json`)

### 9. **Intermission Screens**
   - **Periodic Break**: After every 20 players auctioned, system displays:
     - Player statistics/leaderboard
     - Advertisement screen
     - Team standings
     - Auction progress
   - Allows audience engagement and sponsor visibility
   - Customizable content

### 10. **Fully Customizable System**
   - Easily adapt for different cricket formats:
     - Village leagues
     - Corporate tournaments
     - School/college championships
   - Configurable player lists, team names, and budgets
   - Adjustable bid increments and auction rules
   - Brandable with custom styling

---

## 🏗️ Application Architecture

The Cricket League Auction System consists of two independent interfaces designed to work in concert:

### **Auctioneer Panel** (`localhost:3001`)
- **Purpose**: Control center for the auctioneer
- **Location**: Typically run on a PC/laptop used by the auctioneer
- **Features**:
  - Player management and selection
  - Real-time bid tracking
  - Team budget monitoring
  - Undo/correction options
  - Auction control (start, pause, next player)
  - Status updates and logging
- **Access**: On a dedicated auctioneer computer

### **Dashboard/Display Screen** (`localhost:3000`)
- **Purpose**: Public display of auction information
- **Location**: Projected on a screen/display for live audience viewing
- **Features**:
  - Live team standings
  - Current player information with photo
  - Player details (role, area, age, bid)
  - Sold/unsold status updates
  - Intermission content (leaderboards, ads)
  - Real-time updates synchronized with auctioneer panel
- **Access**: Separate display/projector in the auction venue

### **Backend Server** (`localhost:5000`)
- RESTful API managing all auction logic
- Player and team database management
- Budget tracking and calculations
- Auction state management
- Audio/visual trigger coordination

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **Windows**, **macOS**, or **Linux**
- Two displays or monitors recommended (one for auctioneer, one for public)

### Installation Steps

1. **Clone/Extract the Repository**
   ```bash
   cd CricketLeagueAuction
   ```

2. **Install Dependencies**
   
   Backend:
   ```bash
   cd backend
   npm install
   ```
   
   Frontend:
   ```bash
   cd frontend
   npm install
   ```

3. **Configure the Application**
   - Edit `backend/config.json` for team names, player lists, and budget settings
   - Update `backend/db.js` if using a custom database
   - Modify `frontend/public/sound-config.json` for audio preferences

### Running the Application

#### **Option 1: Automated Startup (Windows)**
Run the batch file launcher from the project root:
```bash
start.bat
```

#### **Option 2: PowerShell**
Run the PowerShell script from the project root:
```bash
start.ps1
```

#### **Option 3: Manual Startup**

Terminal 1 - Start Backend:
```bash
cd backend
npm start
```

Terminal 2 - Start Frontend (Dashboard):
```bash
cd frontend
npm start
```

Terminal 3 - Start Auctioneer Panel:
```bash
cd frontend
PORT=3001 npm start
```

### Access the Application
Once running, open in your web browsers:
- **Auctioneer Panel**: `http://localhost:3001`
- **Live Dashboard**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`

---

## 📋 How to Use During Auction

### Auctioneer Panel Workflow

1. **Start Auction**: Select the first player from the dropdown (serial number guides selection)
2. **Manage Bids**: 
   - Accept bids from teams
   - Use the **+1000 button** for quick increments
   - Display current bid on dashboard
3. **Finalize**:
   - Mark player as **SOLD** (accepts highest bid, updates team budget)
   - Mark player as **UNSOLD** (returns player to pool)
   - Or use **UNDO** if an error was made
4. **Progress**: System automatically advances to next player
5. **Intermissions**: After every 20 players, intermission screen displays automatically

### Dashboard Display

The public dashboard automatically updates with:
- ✅ Current player photo and details
- ✅ Live team standings and budgets
- ✅ Sold/unsold status
- ✅ Audio notifications
- ✅ Intermission content between auction rounds

---

## ⚙️ Customization Guide

### For Different Tournament Types

**Village Cricket League** (Default)
- Standard 20-over format
- Adjust team budgets in `config.json`
- Customize team names and player lists

**Corporate Tournament**
- Modify team names and budgets
- Adjust player base and roles
- Customize display branding

**School/College Championship**
- Reduce budget allocations
- Modify player pool
- Adjust bid increments

### Configuration Files

**Backend Configuration** (`backend/config.json`)
```json
{
  "teams": ["SIDDARAMESHWAR", "MUDGA GAME CHANGERS", ...],
  "startingBudget": 50000,
  "players": [...],
  "preBidDeductions": {
    "SIDDARAMESHWAR": 15000,
    "MUDGA GAME CHANGERS": 15000
  }
}
```

**Audio Settings** (`frontend/public/sound-config.json`)
- Enable/disable sounds
- Customize sound file paths
- Adjust volume levels

**Display Settings** (`frontend/src/App.css`)
- Customize colors and fonts
- Adjust layout proportions
- Modify responsive breakpoints

---

## 🎨 Display Customization

### Styling
- Modify `frontend/src/App.css` for custom colors and fonts
- Update team logos and player photos in `backend/images/player_photo/`
- Customize display layout proportions

### Branding
- Add sponsor logos
- Custom color schemes
- Personalized team banners

---

## 🔧 Troubleshooting

### Backend Not Starting
- Ensure port 5000 is not in use
- Check Node.js installation: `node --version`
- Verify npm packages installed: `npm install` in backend folder

### Frontend Not Loading
- Clear browser cache
- Check ports 3000 and 3001 are available
- Verify frontend packages: `npm install` in frontend folder

### Audio Not Playing
- Check `sound-config.json` is properly configured
- Verify sound files exist in `frontend/public/sounds/`
- Check browser volume settings
- Ensure browser allows autoplay

### Player Photos Not Displaying
- Verify images are in `backend/images/player_photo/`
- Check image file paths match configuration
- Ensure images are in supported format (PNG/JPG)

---

## 📁 Project Structure

```
CricketLeagueAuction/
├── backend/
│   ├── config.json          # Team and player configuration
│   ├── db.js               # Database/data management
│   ├── server.js           # Express backend server
│   ├── package.json        # Backend dependencies
│   └── images/             # Player photos
│
├── frontend/
│   ├── public/
│   │   ├── sounds/         # Audio files for events
│   │   └── pictures/       # Team logos and branding
│   ├── src/
│   │   ├── App.js          # Main dashboard component
│   │   ├── components/
│   │   │   ├── Dashboard.js       # Display screen
│   │   │   └── AuctioneerPanel.js # Control panel
│   │   └── App.css         # Styling
│   └── package.json        # Frontend dependencies
│
├── start.bat               # Windows batch launcher
├── start.ps1              # PowerShell launcher
└── README.md              # This file
```

---

## 📝 License

This project is designed for community cricket league management. Feel free to customize and adapt for your specific needs.

---

## 🤝 Support & Customization

For customization requirements specific to your tournament:
- Modify team names and budgets in configuration files
- Adjust player lists and roles
- Customize display themes and branding
- Add or modify auction rules

The system is fully flexible and can be adapted to suit various cricket tournament formats and requirements.

---

## 🎯 Quick Start Checklist

- [ ] Extract project files
- [ ] Install Node.js if not already installed
- [ ] Run installation steps for backend and frontend
- [ ] Configure `backend/config.json` with your teams and players
- [ ] Update team budgets and pre-bid deductions
- [ ] Test audio by checking `frontend/public/sounds/`
- [ ] Run startup script (`start.bat` or `start.ps1`)
- [ ] Open Auctioneer Panel on auctioneer computer
- [ ] Open Dashboard on projector/public display
- [ ] Start auction! 🏆

