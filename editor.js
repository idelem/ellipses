document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('editor');
    const exportBtn = document.getElementById('exportBtn');
    const toggleBlocksBtn = document.getElementById('toggleBlocksBtn');
    let showBlockBoundaries = false;
    let processingInput = false;
    
    // Define colors for importance
    const importanceColors = {
        'none': '#333333',    // default text color
        'low': '#0099cc',     // blue
        'medium': '#ff9900',  // orange
        'high': '#cc0000',    // darker red
        'urgent': '#ff0000',  // bright red
        'omit': '#999999'     // grey
    };
    
    // Initialize editor
    processText();
    
    // Process text when specific keys are pressed (period, question mark, exclamation, etc.)
    editor.addEventListener('keyup', function(e) {
        // List of keys that might end a sentence
        const sentenceEndKeys = ['.', '?', '!', '。', '？', '！', ')'];
        
        if (sentenceEndKeys.includes(e.key) && !processingInput) {
            processingInput = true;
            setTimeout(() => {
                processText();
                processingInput = false;
            }, 100);
        }
    });
    
    // Export functionality
    exportBtn.addEventListener('click', function() {
        const cleanText = editor.innerText;
        downloadTextFile(cleanText, 'draft.txt');
    });
    
    // Toggle block boundaries
    toggleBlocksBtn.addEventListener('click', function() {
        showBlockBoundaries = !showBlockBoundaries;
        toggleBlocksBtn.textContent = showBlockBoundaries ? 'Hide Block Boundaries' : 'Show Block Boundaries';
        
        const blocks = document.querySelectorAll('.block');
        blocks.forEach(block => {
            if (showBlockBoundaries) {
                block.style.outline = '1px dashed #ccc';
            } else {
                block.style.outline = 'none';
            }
        });
    });
    
    function processText() {
        // Store cursor position carefully
        let savedSelection = saveSelection(editor);
        
        // Get current text content
        let content = editor.innerText;
        
        // Analyze the text and create block structure
        const blockStructure = createBlockStructure(content);
        
        // Apply the block structure to the editor
        editor.innerHTML = blockStructure;
        
        // Add controls to each block
        addBlockControls();
        
        // Restore cursor position
        if (savedSelection) {
            restoreSelection(editor, savedSelection);
        }
    }
    
    function createBlockStructure(content) {
        // Split text into potential blocks based on sentence endings and parentheses
        const sentenceEndRegex = /([.!?…。？！……]+["'"']?)(\s*)/g;
        const parenthesesRegex = /(\([^)]+\))/g;
        
        // First, prepare the content by marking block boundaries
        let markedContent = content
            .replace(sentenceEndRegex, '$1$2###BLOCK_END###')
            .replace(parenthesesRegex, '###BLOCK_END###$1###BLOCK_END###');
        
        // Split into raw blocks
        const rawBlocks = markedContent.split('###BLOCK_END###');
        
        // Format each block with HTML
        let html = '';
        rawBlocks.forEach(block => {
            if (block.trim() !== '') {
                html += `<span class="block">${block}</span>`;
            }
        });
        
        return html;
    }
    
    function addBlockControls() {
        document.querySelectorAll('.block').forEach(block => {
            // Don't add controls if they already exist
            if (block.querySelector('.block-controls')) return;
            
            // Create controls
            const controlsElement = document.createElement('div');
            controlsElement.className = 'block-controls';
            
            // Add color options
            Object.entries(importanceColors).forEach(([level, color]) => {
                const colorDot = document.createElement('span');
                colorDot.className = 'color-dot';
                colorDot.title = level;
                colorDot.style.backgroundColor = color;
                colorDot.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    block.style.color = color;
                });
                controlsElement.appendChild(colorDot);
            });
            
            // Add collapse/expand option
            const toggleBtn = document.createElement('span');
            toggleBtn.textContent = '↔️';
            toggleBtn.title = 'Collapse/Expand';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.marginLeft = '5px';
            toggleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                block.classList.toggle('collapsed');
            });
            controlsElement.appendChild(toggleBtn);
            
            block.appendChild(controlsElement);
        });
    }
    
    // Utility functions for saving and restoring cursor position
    function saveSelection(containerEl) {
        if (!window.getSelection) return null;
        
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;
        
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(containerEl);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        
        return {
            start: start,
            end: start + range.toString().length
        };
    }
    
    function restoreSelection(containerEl, savedSel) {
        if (!window.getSelection || !savedSel) return;
        
        const charIndex = createCharacterIterator(containerEl);
        const range = document.createRange();
        range.setStart(charIndex.findNode(savedSel.start), charIndex.offset);
        range.collapse(true);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    function createCharacterIterator(containerEl) {
        let charIndex = 0;
        let foundStart = false;
        let foundNode = null;
        let foundOffset = 0;
        
        return {
            findNode: function(targetIndex) {
                charIndex = 0;
                foundStart = false;
                foundNode = null;
                foundOffset = 0;
                
                this._walk(containerEl, targetIndex);
                return foundNode;
            },
            _walk: function(node, targetIndex) {
                if (foundStart) return;
                
                if (node.nodeType === 3) { // Text node
                    const nodeLength = node.nodeValue.length;
                    if (charIndex + nodeLength >= targetIndex) {
                        foundNode = node;
                        foundOffset = targetIndex - charIndex;
                        foundStart = true;
                    } else {
                        charIndex += nodeLength;
                    }
                } else if (node.nodeType === 1) { // Element node
                    // Skip invisible elements like the controls
                    if (node.classList && node.classList.contains('block-controls')) {
                        return;
                    }
                    
                    // Process visible children
                    for (let i = 0; i < node.childNodes.length; i++) {
                        this._walk(node.childNodes[i], targetIndex);
                        if (foundStart) break;
                    }
                }
            },
            get offset() {
                return foundOffset;
            }
        };
    }
    
    function downloadTextFile(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
