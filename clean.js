module.exports = function clean(nbaValueReport) {
    const opponents = require("./opponents.json");
    let cleanNbaValueReport = [];

    for (const playerValueReport of nbaValueReport) {
        if(playerValueReport.injury == "NO" || playerValueReport.proj_rotowire == 0 || playerValueReport.sorarAdditionalPlayerValueReport == undefined)
            continue;
        
        let cleanPlayerValueReport = {};

        cleanPlayerValueReport.player = playerValueReport.player;
        cleanPlayerValueReport.injury = playerValueReport.injury;
        cleanPlayerValueReport.lineup_status = playerValueReport.lineup_status;
        cleanPlayerValueReport.over_under = playerValueReport.over_under;
        cleanPlayerValueReport.point_spread = Math.abs(playerValueReport.point_spread);
        cleanPlayerValueReport.proj_rotowire = playerValueReport.proj_rotowire;
        cleanPlayerValueReport.proj_site = playerValueReport.proj_site;
        cleanPlayerValueReport.rest = playerValueReport.rest;
        cleanPlayerValueReport.tenGameAverage = playerValueReport.sorarAdditionalPlayerValueReport.nbaPlayer.tenGameAverage;

        const startsWithAt = playerValueReport.opponent.startsWith("@");
        const uselessKeys = ["fgpct", "ftpct", "oreb", "dreb", "pt3a", "pt3pct", "fgm", "fga", "ftm", "fta", "minutes"];

        for (let body of playerValueReport.additionalPlayerValueReport.splits.nba.body) {
            if (body.season == "Away" && startsWithAt || body.season == "Home" && !startsWithAt) {
                uselessKeys.forEach(key => delete body[key]);

                cleanPlayerValueReport.season_away_and_home = body;

                break;
            }
        }

        for (let body of playerValueReport.additionalPlayerValueReport.splitsOpp.nba.body) {
            if (body.season.includes(playerValueReport.opponent)) {
                uselessKeys.forEach(key => delete body[key]);

                cleanPlayerValueReport.season_opponent = body;

                break;
            }
        }

        cleanPlayerValueReport.opponent = opponents[playerValueReport.opponent] || playerValueReport.opponent;

        for (let body of playerValueReport.additionalPlayerValueReport.splitsRest.nba.body) {
            if (body.season.includes(playerValueReport.rest >= 3 ? "3+" : playerValueReport.rest)) {
                uselessKeys.forEach(key => delete body[key]);

                cleanPlayerValueReport.season_rest = body;

                break;
            }
        }

        cleanPlayerValueReport.latest_final_game_score = [];

        for (let body of playerValueReport.sorarAdditionalPlayerValueReport.nbaPlayer.latestFinalGameStats)
            if (body.playedInGame)
                cleanPlayerValueReport.latest_final_game_score.push(body.score);

        cleanPlayerValueReport.upcoming_games = [];

        for (let body of playerValueReport.sorarAdditionalPlayerValueReport.nbaPlayer.upcomingGames) {
            cleanPlayerValueReport.upcoming_games.push({
                start_date: body.startDate.split("T")[0].split("-").reverse().join("/"),
                id: body.homeTeam.slug + " vs " + body.awayTeam.slug,
            });

            if(cleanPlayerValueReport.upcoming_games.length == 3)
                break;
        }

        cleanNbaValueReport.push(cleanPlayerValueReport);
    }

    return cleanNbaValueReport;
};