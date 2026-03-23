# Auction Sound Effects

Place your sound files in this directory. The sound-config.json file references these files.

## Required Sound Files:
- `player-sold.mp3` - Plays when a player is sold (celebration sound)
- `auction-start.wav` - Plays when auction begins (optional)
- `bid-increase.mp3` - Plays when bid increases (optional)

## Sound File Recommendations:
- **Format**: MP3 or WAV
- **Duration**: 2-5 seconds for celebration sounds
- **Quality**: 128kbps MP3 is sufficient
- **Volume**: Normalize to consistent levels

## Free Sound Resources:
- YouTube Audio Library (search for "celebration sound effect")
- Freesound.org (search for "applause", "success", "tada")
- Zapsplat.com (free downloads available)
- Epidemic Sound (free tier available)

## Example Sounds to Look For:
- Celebration fanfare
- Applause
- Success chime
- Victory trumpet
- Crowd cheer
- "Tada!" sound
- Cash register "ka-ching"
- Stadium crowd noise

## Configuration:
Edit `../sound-config.json` to:
- Change sound file paths
- Enable/disable sounds: `"enableSounds": false`
- Adjust celebration duration: `"celebrationDuration": 3000` (milliseconds)
- Toggle effects: `"fireParticles": true`, `"emojiRain": true`

## Testing Sounds:
1. Add your sound files to this directory
2. Sell a player in the auction
3. Sound should play automatically with the popup

## Browser Compatibility:
- MP3 works in all modern browsers
- WAV is universally supported
- OGG is good for Firefox
- Consider multiple formats if needed