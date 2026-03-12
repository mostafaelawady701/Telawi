const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'RoomView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The goal is to reshape the layout into a 2-column Desktop layout.
// Left Column: Participants + Ready Button + Leaderboard + Recordings
// Right Column: The Main Game Area (Waiting state, Round state, AI rating, Results)

// Step 1: Replace <main> wrapper to Grid
content = content.replace(
  /<main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col gap-8">/,
  `<main className="flex-1 w-full max-w-[1800px] mx-auto px-4 md:px-8 py-6 grid px-4 grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-[calc(100vh-80px)] items-start">
    <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 sticky top-28 h-[calc(100vh-120px)] overflow-y-auto no-scrollbar scroll-smooth pb-10">`
);

// Step 2: Extract Game Area to put it in the Main Right Column
// Locate the Game Area
const gameAreaStartMarker = `{/* Game Area */}`;
const gameAreaStartIndex = content.indexOf(gameAreaStartMarker);

// Find where Game Area ends. It is followed by {/* Leaderboard Section */}
const leaderboardMarker = `{/* Leaderboard Section */}`;
const leaderboardIndex = content.indexOf(leaderboardMarker);

if (gameAreaStartIndex !== -1 && leaderboardIndex !== -1) {
    const gameAreaString = content.substring(gameAreaStartIndex, leaderboardIndex);
    
    // Remove game area from its original position
    content = content.slice(0, gameAreaStartIndex) + content.slice(leaderboardIndex);
    
    // Now the layout is Participants -> Leaderboard -> Recordings.
    // That's perfect for the Left Sidebar!
    // We just need to find the end of the Recordings List (end of `<main>`) to close the left sidebar and inject the right side.
    const endMainMarker = `</main>`;
    const endMainIndex = content.lastIndexOf(endMainMarker);
    
    const beforeEndMain = content.slice(0, endMainIndex);
    const rightColumn = `
    </div> {/* Close Left Sidebar */}
    
    {/* RIGHT STAGE: Main Game Area */}
    <div className="lg:col-span-8 xl:col-span-9 flex flex-col h-[calc(100vh-120px)] overflow-y-auto no-scrollbar pb-10">
      ${gameAreaString}
    </div>
    
    `;
    
    content = beforeEndMain + rightColumn + endMainMarker + content.slice(endMainIndex + endMainMarker.length);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Layout Refactored Successfully!');
