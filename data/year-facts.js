/**
 * Year Facts - Curated cinema facts and a famous in-dataset movie quote per year.
 *
 * Used by the yearly transition card (v3.2). For each year the app surfaces:
 *   - facts: 1-3 short movie/cinema facts about that year
 *   - quote: one famous line from a film RELEASED THAT YEAR that also exists
 *            in this app's movie dataset ({ text, film, who })
 *
 * Accuracy notes:
 *   - Facts are stable film history (box-office milestones, Academy Awards).
 *     Best Picture is credited to the film's release year (the award itself is
 *     handed out the following spring).
 *   - 2024 facts/Best Picture verified against the 97th Academy Awards (Mar 2025).
 *   - 2025 facts verified against the 98th Academy Awards (Mar 2026) and 2025
 *     box-office records. No quote is provided for 2025 because no famous quote
 *     from an in-dataset 2025 film could be reliably verified; the card renders
 *     facts only when quote is null.
 */

const YEAR_FACTS = {
    1980: {
        facts: [
            "The Empire Strikes Back was the year's box-office champion and is now widely considered the best Star Wars film.",
            "Ordinary People won Best Picture, beating Raging Bull and Martin Scorsese.",
            "Airplane! redefined the spoof comedy and launched Leslie Nielsen's deadpan career."
        ],
        quote: { text: "No. I am your father.", film: "The Empire Strikes Back", who: "Darth Vader" }
    },
    1981: {
        facts: [
            "Raiders of the Lost Ark was the year's top earner and introduced Indiana Jones.",
            "Chariots of Fire won Best Picture and its theme became instantly iconic.",
            "Germany's Das Boot set a new bar for the submarine thriller."
        ],
        quote: { text: "Snakes. Why'd it have to be snakes?", film: "Raiders of the Lost Ark", who: "Indiana Jones" }
    },
    1982: {
        facts: [
            "E.T. the Extra-Terrestrial became the highest-grossing film ever made up to that point.",
            "Gandhi won Best Picture and a then-record eight Oscars for a single film.",
            "Blade Runner flopped on release but grew into one of sci-fi's most influential films."
        ],
        quote: { text: "E.T. phone home.", film: "E.T. the Extra-Terrestrial", who: "E.T." }
    },
    1983: {
        facts: [
            "Return of the Jedi was the year's biggest hit and closed the original Star Wars trilogy.",
            "Terms of Endearment won Best Picture.",
            "Brian De Palma's Scarface arrived to controversy and later became a pop-culture landmark."
        ],
        quote: { text: "Say hello to my little friend!", film: "Scarface", who: "Tony Montana" }
    },
    1984: {
        facts: [
            "Ghostbusters and Beverly Hills Cop dominated the box office all year.",
            "Amadeus won Best Picture and eight Academy Awards.",
            "A low-budget film called The Terminator launched James Cameron and Arnold Schwarzenegger's partnership."
        ],
        quote: { text: "I'll be back.", film: "The Terminator", who: "The Terminator" }
    },
    1985: {
        facts: [
            "Back to the Future was the year's number-one film at the box office.",
            "Out of Africa won Best Picture.",
            "The Breakfast Club and The Goonies defined a generation of teen cinema."
        ],
        quote: { text: "Roads? Where we're going, we don't need roads.", film: "Back to the Future", who: "Dr. Emmett Brown" }
    },
    1986: {
        facts: [
            "Top Gun was the year's highest earner and made Tom Cruise a global star.",
            "Platoon won Best Picture and gave Oliver Stone the Best Director Oscar.",
            "James Cameron's Aliens proved a sequel could outdo its classic original."
        ],
        quote: { text: "Get away from her, you bitch!", film: "Aliens", who: "Ellen Ripley" }
    },
    1987: {
        facts: [
            "The Last Emperor swept all nine of its Oscar nominations, including Best Picture.",
            "The Princess Bride underperformed in theaters before becoming a beloved cult classic.",
            "RoboCop and Predator delivered the decade's sharpest sci-fi action."
        ],
        quote: { text: "Hello. My name is Inigo Montoya. You killed my father. Prepare to die.", film: "The Princess Bride", who: "Inigo Montoya" }
    },
    1988: {
        facts: [
            "Rain Man was the year's top-grossing film and won Best Picture.",
            "Who Framed Roger Rabbit broke new ground blending live action and animation.",
            "Die Hard reinvented the action movie and made John McClane an icon."
        ],
        quote: { text: "I'm an excellent driver.", film: "Rain Man", who: "Raymond Babbitt" }
    },
    1989: {
        facts: [
            "Tim Burton's Batman was a box-office phenomenon and reshaped the comic-book movie.",
            "Driving Miss Daisy won Best Picture.",
            "Indiana Jones and the Last Crusade and Dead Poets Society were among the year's most loved films."
        ],
        quote: { text: "Carpe diem. Seize the day, boys.", film: "Dead Poets Society", who: "John Keating" }
    },
    1990: {
        facts: [
            "Ghost was the year's top earner; Home Alone became a holiday phenomenon.",
            "Dances with Wolves won Best Picture and revived the Western.",
            "Martin Scorsese's GoodFellas is now regarded as one of the greatest crime films ever made."
        ],
        quote: { text: "As far back as I can remember, I always wanted to be a gangster.", film: "GoodFellas", who: "Henry Hill" }
    },
    1991: {
        facts: [
            "The Silence of the Lambs swept the 'Big Five' Oscars, only the third film ever to do so.",
            "Terminator 2: Judgment Day was the year's biggest hit and a visual-effects landmark.",
            "Beauty and the Beast became the first animated film nominated for Best Picture."
        ],
        quote: { text: "Hasta la vista, baby.", film: "Terminator 2: Judgment Day", who: "The Terminator" }
    },
    1992: {
        facts: [
            "Disney's Aladdin was the year's top-grossing film worldwide.",
            "Clint Eastwood's Unforgiven won Best Picture and revived the Western.",
            "Reservoir Dogs announced the arrival of Quentin Tarantino."
        ],
        quote: { text: "You can't handle the truth!", film: "A Few Good Men", who: "Col. Nathan Jessup" }
    },
    1993: {
        facts: [
            "Jurassic Park became the highest-grossing film ever and revolutionized digital effects.",
            "Schindler's List won seven Oscars including Best Picture.",
            "Groundhog Day quietly became one of comedy's most enduring classics."
        ],
        quote: { text: "Life, uh... finds a way.", film: "Jurassic Park", who: "Dr. Ian Malcolm" }
    },
    1994: {
        facts: [
            "The Lion King was the year's box-office king; Forrest Gump won Best Picture.",
            "Pulp Fiction electrified independent cinema and revived John Travolta's career.",
            "The Shawshank Redemption flopped in theaters and is now often ranked the greatest film of all time."
        ],
        quote: { text: "Life is like a box of chocolates. You never know what you're gonna get.", film: "Forrest Gump", who: "Forrest Gump" }
    },
    1995: {
        facts: [
            "Toy Story was the first fully computer-animated feature film.",
            "Braveheart won Best Picture and Best Director for Mel Gibson.",
            "Se7en and Heat delivered two of the decade's defining thrillers."
        ],
        quote: { text: "To infinity and beyond!", film: "Toy Story", who: "Buzz Lightyear" }
    },
    1996: {
        facts: [
            "Independence Day was the year's box-office leader.",
            "The English Patient won nine Oscars including Best Picture.",
            "Scream revived the slasher genre and the Coens' Fargo became an instant classic."
        ],
        quote: { text: "Choose life. Choose a job. Choose a career.", film: "Trainspotting", who: "Renton" }
    },
    1997: {
        facts: [
            "Titanic became the highest-grossing film of all time and tied the record with 11 Oscars.",
            "Good Will Hunting won writing Oscars for Matt Damon and Ben Affleck.",
            "Studio Ghibli's Princess Mononoke became a landmark of animation."
        ],
        quote: { text: "I'm the king of the world!", film: "Titanic", who: "Jack Dawson" }
    },
    1998: {
        facts: [
            "Shakespeare in Love upset Saving Private Ryan to win Best Picture.",
            "Saving Private Ryan's opening sequence reset the standard for war films.",
            "The Big Lebowski flopped at first and grew into a genuine cult phenomenon."
        ],
        quote: { text: "The Dude abides.", film: "The Big Lebowski", who: "The Dude" }
    },
    1999: {
        facts: [
            "Often called the greatest year in modern film: The Matrix, Fight Club, and more all arrived.",
            "American Beauty won Best Picture and five Academy Awards.",
            "The Matrix revolutionized action filmmaking with 'bullet time'."
        ],
        quote: { text: "I see dead people.", film: "The Sixth Sense", who: "Cole Sear" }
    },
    2000: {
        facts: [
            "Gladiator won Best Picture and revived the Hollywood historical epic.",
            "Christopher Nolan broke through with the backwards-told thriller Memento.",
            "Cast Away and Crouching Tiger, Hidden Dragon were among the year's biggest hits."
        ],
        quote: { text: "Are you not entertained?", film: "Gladiator", who: "Maximus" }
    },
    2001: {
        facts: [
            "The Lord of the Rings and Harry Potter franchises both launched the same year.",
            "Shrek won the very first Academy Award for Best Animated Feature.",
            "A Beautiful Mind won Best Picture."
        ],
        quote: { text: "One does not simply walk into Mordor.", film: "The Lord of the Rings: The Fellowship of the Ring", who: "Boromir" }
    },
    2002: {
        facts: [
            "Spider-Man kicked off the modern superhero blockbuster era.",
            "Chicago won Best Picture, the first musical to do so in over 30 years.",
            "The Two Towers introduced Gollum, a breakthrough in digital performance."
        ],
        quote: { text: "My precious.", film: "The Lord of the Rings: The Two Towers", who: "Gollum" }
    },
    2003: {
        facts: [
            "The Return of the King won all 11 Oscars it was nominated for, a record sweep.",
            "Pirates of the Caribbean turned a theme-park ride into a hit franchise.",
            "Finding Nemo became Pixar's biggest film yet."
        ],
        quote: { text: "Just keep swimming.", film: "Finding Nemo", who: "Dory" }
    },
    2004: {
        facts: [
            "Shrek 2 was the year's highest-grossing film.",
            "Million Dollar Baby won Best Picture for Clint Eastwood.",
            "Eternal Sunshine of the Spotless Mind became a modern classic of the romance genre."
        ],
        quote: { text: "No capes!", film: "The Incredibles", who: "Edna Mode" }
    },
    2005: {
        facts: [
            "Crash won Best Picture in a famous upset over Brokeback Mountain.",
            "Batman Begins rebooted the Dark Knight and launched Nolan's trilogy.",
            "Revenge of the Sith led the box office and closed the Star Wars prequels."
        ],
        quote: { text: "It's not who I am underneath, but what I do that defines me.", film: "Batman Begins", who: "Bruce Wayne" }
    },
    2006: {
        facts: [
            "The Departed won Best Picture and finally earned Martin Scorsese a directing Oscar.",
            "Pirates of the Caribbean: Dead Man's Chest topped the box office.",
            "Pan's Labyrinth dazzled critics with dark fantasy."
        ],
        quote: { text: "Are you watching closely?", film: "The Prestige", who: "Cutter" }
    },
    2007: {
        facts: [
            "No Country for Old Men won Best Picture for the Coen brothers.",
            "There Will Be Blood earned Daniel Day-Lewis the Best Actor Oscar.",
            "Ratatouille won Best Animated Feature for Pixar."
        ],
        quote: { text: "I drink your milkshake!", film: "There Will Be Blood", who: "Daniel Plainview" }
    },
    2008: {
        facts: [
            "The Dark Knight became a cultural phenomenon; Heath Ledger won a posthumous Oscar as the Joker.",
            "Iron Man launched the Marvel Cinematic Universe.",
            "Slumdog Millionaire won Best Picture and eight Academy Awards."
        ],
        quote: { text: "Why so serious?", film: "The Dark Knight", who: "The Joker" }
    },
    2009: {
        facts: [
            "Avatar became the highest-grossing film of all time and popularized modern 3D.",
            "The Hurt Locker won Best Picture; Kathryn Bigelow became the first woman to win Best Director.",
            "Up was the first Pixar film nominated for Best Picture."
        ],
        quote: { text: "Adventure is out there!", film: "Up", who: "Ellie" }
    },
    2010: {
        facts: [
            "The King's Speech won Best Picture.",
            "Toy Story 3 became the first animated film to gross $1 billion.",
            "Inception turned a cerebral heist concept into a global blockbuster."
        ],
        quote: { text: "You mustn't be afraid to dream a little bigger, darling.", film: "Inception", who: "Eames" }
    },
    2011: {
        facts: [
            "The Artist, a black-and-white silent film, won Best Picture.",
            "Harry Potter and the Deathly Hallows: Part 2 was the year's top earner and ended the series.",
            "Drive became a stylish, much-imitated cult favorite."
        ],
        quote: { text: "You is kind. You is smart. You is important.", film: "The Help", who: "Aibileen Clark" }
    },
    2012: {
        facts: [
            "Argo won Best Picture.",
            "The Avengers assembled Marvel's heroes and became the year's number-one film.",
            "Life of Pi won Ang Lee a Best Director Oscar for its visual artistry."
        ],
        quote: { text: "That's my secret, Captain. I'm always angry.", film: "The Avengers", who: "Bruce Banner" }
    },
    2013: {
        facts: [
            "12 Years a Slave won Best Picture.",
            "Frozen became the highest-grossing animated film at the time and won two Oscars.",
            "Gravity won seven Academy Awards for its groundbreaking visuals."
        ],
        quote: { text: "Sell me this pen.", film: "The Wolf of Wall Street", who: "Jordan Belfort" }
    },
    2014: {
        facts: [
            "Birdman won Best Picture.",
            "Guardians of the Galaxy turned obscure heroes into a box-office smash.",
            "Interstellar and Whiplash were among the year's most acclaimed films."
        ],
        quote: { text: "Not quite my tempo.", film: "Whiplash", who: "Terence Fletcher" }
    },
    2015: {
        facts: [
            "Spotlight won Best Picture.",
            "Star Wars: The Force Awakens shattered box-office records.",
            "Mad Max: Fury Road won six Academy Awards."
        ],
        quote: { text: "Oh, what a day! What a lovely day!", film: "Mad Max: Fury Road", who: "Nux" }
    },
    2016: {
        facts: [
            "Moonlight won Best Picture after the infamous envelope mix-up with La La Land.",
            "Deadpool proved an R-rated superhero film could be a blockbuster.",
            "Your Name. became a global anime phenomenon."
        ],
        quote: { text: "Here's to the ones who dream.", film: "La La Land", who: "Mia" }
    },
    2017: {
        facts: [
            "The Shape of Water won Best Picture for Guillermo del Toro.",
            "Get Out became a phenomenon and won Best Original Screenplay.",
            "Coco won Best Animated Feature."
        ],
        quote: { text: "Remember me.", film: "Coco", who: "Héctor" }
    },
    2018: {
        facts: [
            "Green Book won Best Picture.",
            "Black Panther became a cultural milestone and the first superhero film nominated for Best Picture.",
            "Spider-Man: Into the Spider-Verse won Best Animated Feature."
        ],
        quote: { text: "Wakanda forever!", film: "Black Panther", who: "T'Challa" }
    },
    2019: {
        facts: [
            "Parasite became the first non-English-language film to win Best Picture.",
            "Avengers: Endgame became the highest-grossing film of all time.",
            "Joaquin Phoenix won Best Actor for Joker."
        ],
        quote: { text: "I love you 3000.", film: "Avengers: Endgame", who: "Morgan Stark" }
    },
    2020: {
        facts: [
            "With theaters largely closed by the pandemic, Nomadland won Best Picture.",
            "Demon Slayer: Mugen Train became a global box-office phenomenon.",
            "Pixar's Soul won Best Animated Feature."
        ],
        quote: { text: "The whole world is watching.", film: "The Trial of the Chicago 7", who: "The protesters" }
    },
    2021: {
        facts: [
            "CODA won Best Picture, the first film from a streaming service to do so.",
            "Spider-Man: No Way Home revived the box office, crossing $1 billion during the pandemic.",
            "Dune won six Academy Awards."
        ],
        quote: { text: "Fear is the mind-killer.", film: "Dune", who: "Paul Atreides" }
    },
    2022: {
        facts: [
            "Everything Everywhere All at Once swept the Oscars with seven wins including Best Picture.",
            "Top Gun: Maverick revived the post-pandemic box office.",
            "Avatar: The Way of Water became one of the highest-grossing films ever."
        ],
        quote: { text: "It's not the plane, it's the pilot.", film: "Top Gun: Maverick", who: "Maverick" }
    },
    2023: {
        facts: [
            "'Barbenheimer' became a cultural moment as Barbie and Oppenheimer opened the same day.",
            "Oppenheimer won Best Picture and seven Academy Awards.",
            "Barbie was the year's number-one film at the box office."
        ],
        quote: { text: "Now I am become Death, the destroyer of worlds.", film: "Oppenheimer", who: "J. Robert Oppenheimer" }
    },
    2024: {
        facts: [
            "Anora won Best Picture at the 2025 Oscars, earning Sean Baker four awards in one night.",
            "Inside Out 2 became the highest-grossing animated film of all time.",
            "Deadpool & Wolverine became the highest-grossing R-rated film ever."
        ],
        quote: { text: "Long live the fighters!", film: "Dune: Part Two", who: "The Fremen" }
    },
    2025: {
        facts: [
            "One Battle After Another won Best Picture at the 98th Academy Awards.",
            "Ne Zha 2 became the first animated film to gross $2 billion worldwide.",
            "James Gunn's Superman rebooted the DC cinematic universe."
        ],
        quote: null
    }
};

// Expose globally for the app (matches the pattern used by data/movies.js)
window.YEAR_FACTS = YEAR_FACTS;
