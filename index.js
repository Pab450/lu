const { Parser, transforms: { flatten } } = require("json2csv");
const cliProgress = require("cli-progress");
const clean = require("./clean");
const axios = require("axios");
const fs = require("fs");

axios.get("https://www.rotowire.com/daily/nba/value-report.php").then(response => {
    const bar = new cliProgress.SingleBar({
        format: "Treatment | {bar} | {percentage}% | {value}/{total} {error}",
    }, cliProgress.Presets.shades_classic);

    const slateId = response.data.match(/data-slateid="(.*)"/)[1].split('"')[0];
    let error = "";

    axios.get(`https://www.rotowire.com/daily/tables/value-report-nba.php?siteID=1&slateID=${slateId}&projSource=RotoWire`).then(async response => {
        let nbaValueReport = response.data;

        bar.start(nbaValueReport.length, 0, { error: "" });
        
        for (let playerValueReport of nbaValueReport) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            await axios.get(`https://www.rotowire.com/basketball/ajax/player-page-data.php?id=${playerValueReport.id}&team=${playerValueReport.team}&nba=false`).then(response => {
                playerValueReport.additionalPlayerValueReport = response.data;
            });

            playerValueReport.sorarePlayerValueReport = await axios.post("https://7z0z8pasdy-dsn.algolia.net/1/indexes/*/queries?x-algolia-api-key=4efd78ac67e55d3f6f37e7ebcd2295d8&x-algolia-application-id=7Z0Z8PASDY", {
                requests: [
                    {
                        indexName: "Player",
                        params: `filters=sport%3Anba&hitsPerPage=1&query=${playerValueReport.player}`
                    }
                ]
            }).then(response => response.data);

            try {
                const body = JSON.stringify({
                    operationName: "NBAPlayerQuery",
                    variables: {
                        slug: playerValueReport.sorarePlayerValueReport.results[0].hits[0].objectID
                    },
                    query: "query NBAPlayerQuery($slug: String!) { nbaPlayer(slug: $slug) {  ...PlayerPageHeader_player    ...NBAPlayerPositionsWithTooltip_player    ...NBAPlayerSearch_player    ...NBAPlayerDescription_player    __typename  }}fragment PlayerPageHeader_player on PlayerInterface {  ...PlayerAvatar_player  slug  avatarImageUrl  displayName  team {    id    slug    fullName    __typename  }  birthDate  ... on NBAPlayer {    birthPlaceCountry    shirtNumber    __typename  }  ... on BaseballPlayer {    birthPlaceCountry    shirtNumber    __typename  }  __typename}fragment PlayerAvatar_player on PlayerInterface {  slug  displayName  avatarImageUrl  __typename}fragment NBAPlayerPositionsWithTooltip_player on NBAPlayer {  positions  __typename}fragment NBAPlayerDescription_player on NBAPlayer {  slug  tenGameAverage  latestFinalGameStats(last: 10) {    ...NBALastGamesPerformanceDialogBody_gameStats    ...NBAPlayerGameScoresRow_gameStats    __typename  }  upcomingGames(next: 6) {    ...UpcomingGames_NBAGame    __typename  }  ...Status_NBAPlayer  __typename}fragment NBAPlayerGameScoresRow_gameStats on NBAPlayerGameStats {  playedInGame  score  team {    slug    __typename  }  game {    id    startDate    status    homeScore    awayScore    quarter    isHalftime    homeTeam {      id      name      slug      svgUrl      abbreviation      __typename    }    awayTeam {      id      name      slug      svgUrl      abbreviation      __typename    }    __typename  }  __typename}fragment NBALastGamesPerformanceDialogBody_gameStats on NBAPlayerGameStats {  ...NBAGameStatsCard_gameStats  ...NBAPlayerGameScoresRow_gameStats  __typename}fragment NBAGameStatsCard_gameStats on NBAPlayerGameStats {  detailedStats {    points    rebounds    assists    blocks    steals    turnovers    made3PointFGs    doubleDoubles    tripleDoubles    __typename  }  detailedScores {    points    rebounds    assists    blocks    steals    turnovers    made3PointFGs    doubleDoubles    tripleDoubles    __typename  }  __typename}fragment UpcomingGames_NBAGame on NBAGame {  id  ...NBAGame_game  __typename}fragment NBAGame_game on NBAGame {  id  status  startDate  homeScore  awayScore  homeTeam {    slug    name    svgUrl    __typename  }  awayTeam {    slug    name    svgUrl    __typename  }  quarter  isHalftime  __typename}fragment Status_NBAPlayer on NBAPlayer {  slug  isActive  __typename}fragment NBAPlayerSearch_player on NBAPlayer {  slug  displayName  __typename}"
                });

                playerValueReport.sorarAdditionalPlayerValueReport = await axios.post("https://api.sorare.com/sports/graphql", body, {
                    headers: {
                        "content-type": "application/json",
                    }
                }).then(response => response.data.data);
            } catch (err) {
                error = `| An error occured for the player ${playerValueReport.player}, error: ${err}`;
            }

            bar.increment(1, { error: error });
        }

        const json2csvParser = new Parser({
            transforms: [
                flatten({
                    separator: "_",
                    objects: "true", 
                    arrays: "true"
                })
            ]
        });

        if (!fs.existsSync("export"))
            fs.mkdirSync("export");

        fs.writeFileSync("export/nbaValueReport.json", JSON.stringify(nbaValueReport));
        fs.writeFileSync("export/cleanNbaValueReport.csv", json2csvParser.parse(clean(nbaValueReport)));

        bar.stop();
    });
});