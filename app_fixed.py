from flask import Flask, render_template_string

app = Flask(__name__)

# Collection of 10 inspiring quotes
QUOTES = [
    {
        "text": "The only way to do great work is to love what you do.",
        "author": "Steve Jobs"
    },
    {
        "text": "Life is what happens when you're busy making other plans.",
        "author": "John Lennon"
    },
    {
        "text": "The future belongs to those who believe in the beauty of their dreams.",
        "author": "Eleanor Roosevelt"
    },
    {
        "text": "It is during our darkest moments that we must focus to see the light.",
        "author": "Aristotle"
    },
    {
        "text": "Do not go where the path may lead, go instead where there is no path and leave a trail.",
        "author": "Ralph Waldo Emerson"
    },
    {
        "text": "You will face many challenges in your life. When you face them, smile.",
        "author": "Steve Jobs"
    },
    {
        "text": "Success is not final, failure is not fatal: It is the courage to continue that counts.",
        "author": "Winston Churchill"
    },
    {
        "text": "Believe you can and you're halfway there.",
        "author": "Theodore Roosevelt"
    },
    {
        "text": "The best way to predict the future is to create it.",
        "author": "Peter Drucker"
    },
    {
        "text": "Don't watch the clock; do what it does. Keep going.",
        "author": "Sam Levenson"
    }
]

# HTML template with embedded CSS and JavaScript
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quote of the Day</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #e0e0e0;
            padding: 20px;
        }

        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px 60px;
            max-width: 700px;
            width: 100%;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        h1 {
            font-size: 2.5rem;
            margin-bottom: 30px;
            color: #fff;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            letter-spacing: 2px;
        }

        .quote-box {
            min-height: 150px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin-bottom: 30px;
        }

        .quote-text {
            font-size: 1.4rem;
            line-height: 1.6;
            font-style: italic;
            color: #a0c4ff;
            margin-bottom: 15px;
            padding: 0 20px;
        }

        .quote-author {
            font-size: 1.1rem;
            color: #6c757d;
            font-weight: 500;
        }

        .author-name {
            color: #4fc3f7;
            font-weight: 600;
        }

        .refresh-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 1.1rem;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            font-weight: 600;
            letter-spacing: 1px;
        }

        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        .refresh-btn:active {
            transform: translateY(0);
        }

        .refresh-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .fade-in {
            animation: fadeIn 0.5s ease-in-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .quote-box.fade-in {
            animation: fadeIn 0.5s ease-in-out;
        }

        @media (max-width: 600px) {
            .container {
                padding: 30px 20px;
            }

            h1 {
                font-size: 1.8rem;
            }

            .quote-text {
                font-size: 1.1rem;
            }

            .refresh-btn {
                padding: 12px 30px;
                font-size: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💭 Quote of the Day</h1>
        <div class="quote-box" id="quote-box">
            <p class="quote-text" id="quote-text">Loading...</p>
            <p class="quote-author">— <span class="author-name" id="quote-author">...</span></p>
        </div>
        <button class="refresh-btn" id="refresh-btn" onclick="newQuote()">✨ New Quote</button>
    </div>

    <script>
        function newQuote() {
            const quoteBox = document.getElementById('quote-box');
            const quoteText = document.getElementById('quote-text');
            const quoteAuthor = document.getElementById('quote-author');
            const refreshBtn = document.getElementById('refresh-btn');

            // Disable button and remove animation class
            refreshBtn.disabled = true;
            quoteBox.classList.remove('fade-in');

            // Force reflow to restart animation
            void quoteBox.offsetWidth;

            // Generate random quote
            const randomIndex = Math.floor(Math.random() * {{ quotes|length }});
            const quote = {{ quotes|tojson }}[randomIndex];

            // Update content
            quoteText.textContent = quote.text;
            quoteAuthor.textContent = quote.author;

            // Add animation class
            quoteBox.classList.add('fade-in');

            // Re-enable button after animation
            setTimeout(() => {
                refreshBtn.disabled = false;
            }, 500);
        }

        // Load a random quote on page load
        newQuote();
    </script>
</body>
</html>
'''

@app.route("/")
def home():
    return render_template_string(HTML_TEMPLATE)

if __name__ == "__main__":
    app.run(debug=True, port=5000)