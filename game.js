class Game2048 {
    constructor() {
        this.gridContainer = document.querySelector('.grid-container');
        this.scoreElement = document.getElementById('score');
        this.bestScoreElement = document.getElementById('best-score');
        this.modeSelector = document.getElementById('game-mode');
        this.newGameButton = document.getElementById('new-game');
        this.aiButton = document.getElementById('ai-play');
        
        // Always start with classic mode
        this.mode = 'classic';
        this.gridSize = 4;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
        this.gameOver = false;
        this.hasWon = false;
        this.isAIPlaying = false;
        this.aiDelay = 50;
        
        // Force select classic mode in dropdown
        this.modeSelector.value = 'classic';
        
        this.setupEventListeners();
        this.initializeGame();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault();
                if (!this.isAIPlaying) {
                    this.move(event.key);
                }
            }
        });

        this.modeSelector.addEventListener('change', () => {
            this.changeMode(this.modeSelector.value);
        });

        this.newGameButton.addEventListener('click', () => {
            this.initializeGame();
        });

        this.aiButton.addEventListener('click', () => {
            this.toggleAI();
        });
    }

    toggleAI() {
        this.isAIPlaying = !this.isAIPlaying;
        const aiButton = document.getElementById('ai-play');
        
        if (this.isAIPlaying) {
            aiButton.textContent = 'Stop AI';
            aiButton.classList.add('playing');
            this.makeAIMove();
        } else {
            aiButton.textContent = 'Let AI Play';
            aiButton.classList.remove('playing');
        }
    }

    async makeAIMove() {
        if (!this.isAIPlaying || this.gameOver) return;

        const bestMove = this.findBestMove();
        if (bestMove) {
            // In reverse mode, invert the AI's chosen direction
            if (this.mode === 'reverse') {
                const reverseMap = {
                    'ArrowUp': 'ArrowDown',
                    'ArrowDown': 'ArrowUp',
                    'ArrowLeft': 'ArrowRight',
                    'ArrowRight': 'ArrowLeft'
                };
                this.move(reverseMap[bestMove] || bestMove);
            } else {
                this.move(bestMove);
            }
        }

        if (this.isAIPlaying && !this.gameOver) {
            setTimeout(() => this.makeAIMove(), this.aiDelay);
        }
    }

    findBestMove() {
        const moves = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
        let bestScore = -Infinity;
        let bestMove = null;

        for (const move of moves) {
            const gridCopy = this.grid.map(row => [...row]);
            const result = this.simulateMove(move, gridCopy);
            
            if (result.moved) {
                const score = this.expectimax(result.grid, 4, true);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
        }

        return bestMove;
    }

    expectimax(grid, depth, isMaxNode) {
        if (depth === 0) {
            return this.evaluatePosition(grid);
        }

        if (isMaxNode) {
            let maxScore = -Infinity;
            const moves = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
            
            for (const move of moves) {
                const gridCopy = grid.map(row => [...row]);
                const result = this.simulateMove(move, gridCopy);
                
                if (result.moved) {
                    const score = this.expectimax(result.grid, depth - 1, false);
                    maxScore = Math.max(maxScore, score);
                }
            }
            
            return maxScore === -Infinity ? this.evaluatePosition(grid) : maxScore;
        } else {
            // Chance node: simulate random tile spawns
            let totalScore = 0;
            let emptyCells = this.getEmptyCells(grid);
            
            if (emptyCells.length === 0) {
                return this.evaluatePosition(grid);
            }

            // Sample a subset of empty cells for performance
            const sampleSize = Math.min(3, emptyCells.length);
            const sampledCells = this.sampleCells(emptyCells, sampleSize);
            
            // Try both 2 and 4 tiles in sampled positions
            for (const cell of sampledCells) {
                // 90% chance of 2, 10% chance of 4
                const gridWith2 = grid.map(row => [...row]);
                gridWith2[cell.x][cell.y] = 2;
                totalScore += 0.9 * this.expectimax(gridWith2, depth - 1, true);

                const gridWith4 = grid.map(row => [...row]);
                gridWith4[cell.x][cell.y] = 4;
                totalScore += 0.1 * this.expectimax(gridWith4, depth - 1, true);
            }
            
            return totalScore / sampledCells.length;
        }
    }

    simulateMove(direction, grid) {
        const vector = this.getVector(direction);
        let moved = false;
        const mergedTiles = new Set();
        const traversals = this.buildTraversals(vector);

        for (let x of traversals.x) {
            for (let y of traversals.y) {
                const cell = { x, y };
                const tile = grid[x][y];

                if (tile !== 0) {
                    const positions = this.findFarthestPosition(cell, vector, grid);
                    const next = positions.next;

                    if (this.withinBounds(next) && 
                        grid[next.x][next.y] === tile && 
                        !mergedTiles.has(`${next.x}-${next.y}`)) {
                        grid[next.x][next.y] *= 2;
                        grid[x][y] = 0;
                        mergedTiles.add(`${next.x}-${next.y}`);
                        moved = true;
                    } else {
                        const position = positions.farthest;
                        if (position.x !== x || position.y !== y) {
                            grid[position.x][position.y] = tile;
                            grid[x][y] = 0;
                            moved = true;
                        }
                    }
                }
            }
        }

        return { moved, grid };
    }

    evaluatePosition(grid) {
        const weights = {
            monotonicity: 4.0,
            smoothness: 1.0,
            maxValue: 2.0,
            emptyTiles: 2.7,
            cornerMax: 2.8,
            snakePattern: 1.6,
            mergePotential: 1.0
        };

        let score = 0;

        // Corner-weighted monotonicity
        const cornerWeights = [
            [4.0, 3.0, 2.0, 1.0],
            [3.0, 2.0, 1.0, 0.5],
            [2.0, 1.0, 0.5, 0.25],
            [1.0, 0.5, 0.25, 0.1]
        ];

        let monotonicityScore = 0;
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (grid[i][j] !== 0) {
                    const weight = i < cornerWeights.length && j < cornerWeights[i].length ? 
                                 cornerWeights[i][j] : 0.1;
                    monotonicityScore += grid[i][j] * weight;
                }
            }
        }

        // Smoothness: prefer tiles with similar values next to each other
        let smoothnessScore = 0;
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (grid[i][j] !== 0) {
                    const value = Math.log2(grid[i][j]);
                    // Check horizontal neighbor
                    if (j < this.gridSize - 1 && grid[i][j + 1] !== 0) {
                        smoothnessScore -= Math.abs(value - Math.log2(grid[i][j + 1]));
                    }
                    // Check vertical neighbor
                    if (i < this.gridSize - 1 && grid[i + 1][j] !== 0) {
                        smoothnessScore -= Math.abs(value - Math.log2(grid[i + 1][j]));
                    }
                }
            }
        }

        // Snake pattern (zigzag from top-left to bottom-right)
        let snakeScore = 0;
        let shouldDecrease = false;
        for (let i = 0; i < this.gridSize; i++) {
            const row = shouldDecrease ? [...grid[i]].reverse() : grid[i];
            for (let j = 0; j < this.gridSize - 1; j++) {
                if (row[j] >= row[j + 1]) {
                    snakeScore += Math.log2(row[j] || 1);
                }
            }
            shouldDecrease = !shouldDecrease;
        }

        // Maximum value and position
        const maxValue = Math.max(...grid.flat());
        let cornerMax = 0;
        const corners = [{x: 0, y: 0}, {x: 0, y: this.gridSize-1}, 
                        {x: this.gridSize-1, y: 0}, {x: this.gridSize-1, y: this.gridSize-1}];
        for (const corner of corners) {
            if (grid[corner.x][corner.y] === maxValue) {
                cornerMax = maxValue;
                break;
            }
        }

        // Empty tiles
        const emptyTiles = grid.flat().filter(x => x === 0).length;

        // Merge potential
        let mergePotential = 0;
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (grid[i][j] !== 0) {
                    // Check right and down for possible merges
                    if (j < this.gridSize - 1 && grid[i][j] === grid[i][j + 1]) {
                        mergePotential += Math.log2(grid[i][j]);
                    }
                    if (i < this.gridSize - 1 && grid[i][j] === grid[i + 1][j]) {
                        mergePotential += Math.log2(grid[i][j]);
                    }
                }
            }
        }

        // Combine all scores with weights
        score += weights.monotonicity * monotonicityScore;
        score += weights.smoothness * smoothnessScore;
        score += weights.maxValue * Math.log2(maxValue);
        score += weights.emptyTiles * Math.pow(emptyTiles, 1.5);
        score += weights.cornerMax * (cornerMax ? Math.log2(cornerMax) : 0);
        score += weights.snakePattern * snakeScore;
        score += weights.mergePotential * mergePotential;

        return score;
    }

    getEmptyCells(grid) {
        const emptyCells = [];
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (grid[i][j] === 0) {
                    emptyCells.push({x: i, y: j});
                }
            }
        }
        return emptyCells;
    }

    sampleCells(cells, size) {
        const shuffled = [...cells];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, size);
    }

    changeMode(newMode) {
        this.mode = newMode;
        this.gridSize = newMode === 'expanded' ? 8 : 4;
        
        // Update container classes
        this.gridContainer.className = 'grid-container';
        this.gridContainer.classList.add(newMode);
        
        // Reset game with new mode
        this.initializeGame();
    }

    initializeGame() {
        // Clear the grid container
        this.gridContainer.innerHTML = '';
        
        // Reset game state
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        this.tiles = new Map();
        this.score = 0;
        this.gameOver = false;
        this.hasWon = false;
        this.mergedTiles = new Set();
        
        // Update scores
        this.updateScore();
        
        // Setup grid and add initial tiles
        this.setupGrid();
        this.addNewTile();
        this.addNewTile();
    }

    setupGrid() {
        // Calculate tile size based on container width
        const containerWidth = this.gridContainer.clientWidth;
        const gap = 15;
        const cellSize = (containerWidth - (this.gridSize + 1) * gap) / this.gridSize;
        
        // Update grid container styles
        this.gridContainer.style.setProperty('--grid-size', this.gridSize);
        this.gridContainer.style.setProperty('--cell-size', cellSize + 'px');
        this.gridContainer.style.setProperty('--grid-gap', gap + 'px');
        
        // Create grid cells
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            this.gridContainer.appendChild(cell);
        }
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('best-score').textContent = this.bestScore;
    }

    addNewTile() {
        const emptyCells = [];
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                if (this.grid[i][j] === 0) {
                    emptyCells.push({ x: i, y: j });
                }
            }
        }

        if (emptyCells.length > 0) {
            const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4;
            this.grid[x][y] = value;
            this.createTileElement(x, y, value, true);
        }
    }

    createTileElement(x, y, value, isNew = false) {
        const tile = document.createElement('div');
        tile.className = `tile tile-${value}${isNew ? ' new' : ''}`;
        tile.textContent = value;
        this.positionTile(tile, x, y);
        this.gridContainer.appendChild(tile);
        this.tiles.set(`${x}-${y}`, tile);
    }

    positionTile(tile, x, y) {
        const containerWidth = this.gridContainer.clientWidth;
        const gap = 15;
        const cellSize = (containerWidth - (this.gridSize + 1) * gap) / this.gridSize;
        
        tile.style.width = cellSize + 'px';
        tile.style.height = cellSize + 'px';
        tile.style.transform = `translate(${y * (cellSize + gap) + gap}px, ${x * (cellSize + gap) + gap}px)`;
    }

    moveTileElement(tile, newX, newY) {
        const containerWidth = this.gridContainer.clientWidth;
        const gap = 15;
        const cellSize = (containerWidth - (this.gridSize + 1) * gap) / this.gridSize;
        
        // Remove any existing transition classes
        tile.classList.remove('merged', 'falling');
        
        // Force a reflow to ensure the transition works
        void tile.offsetWidth;
        
        // Add appropriate class based on movement type
        if (this.mode === 'gravity' && newX > parseInt(tile.getAttribute('data-x'))) {
            tile.classList.add('falling');
        }
        
        // Update position attributes
        tile.setAttribute('data-x', newX);
        tile.setAttribute('data-y', newY);
        
        // Apply the transform
        tile.style.transform = `translate(${newY * (cellSize + gap) + gap}px, ${newX * (cellSize + gap) + gap}px)`;
    }

    mergeTiles(currentTile, mergeTile, newX, newY, newValue) {
        const containerWidth = this.gridContainer.clientWidth;
        const gap = 15;
        const cellSize = (containerWidth - (this.gridSize + 1) * gap) / this.gridSize;
        
        // Move current tile to new position
        currentTile.style.transform = `translate(${newY * (cellSize + gap) + gap}px, ${newX * (cellSize + gap) + gap}px)`;
        currentTile.textContent = newValue;
        currentTile.className = `tile tile-${newValue} merged`;
        
        // Remove the merge target tile
        mergeTile.remove();
    }

    getVector(direction) {
        const vectors = {
            'ArrowUp': { x: -1, y: 0 },
            'ArrowDown': { x: 1, y: 0 },
            'ArrowLeft': { x: 0, y: -1 },
            'ArrowRight': { x: 0, y: 1 }
        };
        return vectors[direction];
    }

    buildTraversals(vector) {
        const traversals = { x: [], y: [] };
        
        for (let pos = 0; pos < this.gridSize; pos++) {
            traversals.x.push(pos);
            traversals.y.push(pos);
        }

        // Always traverse from the farthest cell in the chosen direction
        if (vector.x === 1) traversals.x.reverse();
        if (vector.y === 1) traversals.y.reverse();

        return traversals;
    }

    findFarthestPosition(cell, vector) {
        let previous;
        let next = { x: cell.x, y: cell.y };

        do {
            previous = next;
            next = {
                x: previous.x + vector.x,
                y: previous.y + vector.y
            };
        } while (this.withinBounds(next) && this.grid[next.x][next.y] === 0);

        return {
            farthest: previous,
            next: next
        };
    }

    withinBounds(position) {
        return position.x >= 0 && position.x < this.gridSize &&
               position.y >= 0 && position.y < this.gridSize;
    }

    move(direction) {
        if (this.gameOver) return;

        // In reverse mode, invert the direction
        if (this.mode === 'reverse') {
            const reverseMap = {
                'ArrowUp': 'ArrowDown',
                'ArrowDown': 'ArrowUp',
                'ArrowLeft': 'ArrowRight',
                'ArrowRight': 'ArrowLeft'
            };
            direction = reverseMap[direction] || direction;
        }

        const vector = this.getVector(direction);
        if (!vector) return;  // Invalid direction

        let moved = false;
        this.mergedTiles.clear();

        // Get cells in correct order based on direction
        const traversals = this.buildTraversals(vector);

        // Process moves
        for (let x of traversals.x) {
            for (let y of traversals.y) {
                const cell = { x, y };
                const tile = this.grid[x][y];

                if (tile !== 0) {
                    const positions = this.findFarthestPosition(cell, vector);
                    const next = positions.next;

                    if (this.withinBounds(next) && 
                        this.grid[next.x][next.y] === tile && 
                        !this.mergedTiles.has(`${next.x}-${next.y}`)) {
                        // Merge tiles
                        const newValue = tile * 2;
                        this.grid[next.x][next.y] = newValue;
                        this.grid[x][y] = 0;

                        // Move tile element
                        const currentTile = this.tiles.get(`${x}-${y}`);
                        const mergeTile = this.tiles.get(`${next.x}-${next.y}`);
                        if (currentTile && mergeTile) {
                            this.mergeTiles(currentTile, mergeTile, next.x, next.y, newValue);
                            this.tiles.delete(`${next.x}-${next.y}`);
                            this.tiles.set(`${next.x}-${next.y}`, currentTile);
                            this.tiles.delete(`${x}-${y}`);
                        }

                        // Update score
                        this.score += newValue;
                        if (this.score > this.bestScore) {
                            this.bestScore = this.score;
                            localStorage.setItem('bestScore', this.bestScore);
                        }
                        this.updateScore();

                        // Check for victory
                        if (newValue >= 2048 && !this.hasWon) {
                            this.hasWon = true;
                            setTimeout(() => this.showVictoryModal(), 300);
                        }

                        // Mark as merged
                        this.mergedTiles.add(`${next.x}-${next.y}`);
                        moved = true;
                    } else {
                        const position = positions.farthest;
                        if (position.x !== x || position.y !== y) {
                            // Move tile
                            this.grid[position.x][position.y] = tile;
                            this.grid[x][y] = 0;

                            // Move tile element
                            const currentTile = this.tiles.get(`${x}-${y}`);
                            if (currentTile) {
                                this.moveTileElement(currentTile, position.x, position.y);
                                this.tiles.delete(`${x}-${y}`);
                                this.tiles.set(`${position.x}-${position.y}`, currentTile);
                            }
                            moved = true;
                        }
                    }
                }
            }
        }

        if (moved) {
            this.addNewTile();
            
            // Apply gravity if in gravity mode and not moving downward
            if (this.mode === 'gravity' && direction !== 'ArrowDown') {
                setTimeout(() => this.applyGravity(), 150);
            }
            
            // Check for game over after gravity settles
            if (this.isGameOver()) {
                this.gameOver = true;
                setTimeout(() => this.showGameOverModal(), 300);
            }
        } else if (this.mode === 'gravity' && direction !== 'ArrowDown') {
            // Even if no move occurred, still apply gravity in gravity mode
            this.applyGravity();
        }
    }

    applyGravity() {
        let moved = false;
        let settled = false;
        
        while (!settled) {
            settled = true;
            
            // Start from bottom-second row, move up
            for (let x = this.gridSize - 2; x >= 0; x--) {
                for (let y = 0; y < this.gridSize; y++) {
                    if (this.grid[x][y] !== 0) {
                        let currentX = x;
                        
                        // Keep moving down until we hit bottom or another tile
                        while (currentX < this.gridSize - 1 && this.grid[currentX + 1][y] === 0) {
                            // Move tile down
                            this.grid[currentX + 1][y] = this.grid[currentX][y];
                            this.grid[currentX][y] = 0;
                            
                            // Move tile element
                            const tile = this.tiles.get(`${currentX}-${y}`);
                            if (tile) {
                                this.moveTileElement(tile, currentX + 1, y);
                                this.tiles.delete(`${currentX}-${y}`);
                                this.tiles.set(`${currentX + 1}-${y}`, tile);
                            }
                            
                            currentX++;
                            moved = true;
                            settled = false;
                        }
                        
                        // Check for merges after falling
                        if (currentX < this.gridSize - 1 && 
                            this.grid[currentX + 1][y] === this.grid[currentX][y] && 
                            !this.mergedTiles.has(`${currentX + 1}-${y}`)) {
                            
                            const newValue = this.grid[currentX][y] * 2;
                            this.grid[currentX + 1][y] = newValue;
                            this.grid[currentX][y] = 0;
                            
                            // Handle tile elements for merge
                            const currentTile = this.tiles.get(`${currentX}-${y}`);
                            const mergeTile = this.tiles.get(`${currentX + 1}-${y}`);
                            if (currentTile && mergeTile) {
                                this.mergeTiles(currentTile, mergeTile, currentX + 1, y, newValue);
                                this.tiles.delete(`${currentX + 1}-${y}`);
                                this.tiles.set(`${currentX + 1}-${y}`, currentTile);
                                this.tiles.delete(`${currentX}-${y}`);
                            }
                            
                            // Update score
                            this.score += newValue;
                            if (this.score > this.bestScore) {
                                this.bestScore = this.score;
                                localStorage.setItem('bestScore', this.bestScore);
                            }
                            this.updateScore();
                            
                            // Mark as merged
                            this.mergedTiles.add(`${currentX + 1}-${y}`);
                            moved = true;
                            settled = false;
                        }
                    }
                }
            }
        }
        
        if (moved) {
            // Clear merged tiles after all gravity is applied
            this.mergedTiles.clear();
            
            // Check for game over after gravity settles
            if (this.isGameOver()) {
                this.gameOver = true;
                setTimeout(() => this.showGameOverModal(), 300);
            }
        }
    }

    isGameOver() {
        // Check if there are any empty cells
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                if (this.grid[x][y] === 0) return false;
            }
        }

        // Check if any adjacent tiles can be merged
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const currentValue = this.grid[x][y];
                // Check right neighbor
                if (y < this.gridSize - 1 && this.grid[x][y + 1] === currentValue) return false;
                // Check bottom neighbor
                if (x < this.gridSize - 1 && this.grid[x + 1][y] === currentValue) return false;
            }
        }

        return true;
    }

    showGameOverModal() {
        const modal = document.getElementById('gameover-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
    }

    showVictoryModal() {
        const modal = document.getElementById('victory-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
    }

    setupVictoryModal() {
        const modal = document.getElementById('victory-modal');
        const newGameBtn = document.getElementById('new-game-victory');

        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('show');
                }
                this.initializeGame();
            });
        }
    }

    setupGameOverModal() {
        const modal = document.getElementById('gameover-modal');
        const newGameBtn = document.getElementById('new-game-loss');

        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('show');
                }
                this.initializeGame();
            });
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game2048();
});
