const CourseDashboard = require('../models/courseDashboard');
const Video = require('../models/video');
const axios = require('axios');
const youtubeApiKey = process.env.YOUTUBE_API_KEY;
const chapters = require('../utils/chapters');
const checkUrl = require('../utils/checkUrl');

module.exports.index = async (req, res) => {
    const dashboards = await CourseDashboard.find({ author: req.user._id });
    res.render('courseDashboards', { dashboards });
}

module.exports.renderNewCourseDashboardForm = async (req, res) => {
    res.render('courseDashboards/new');
}

module.exports.createCourseDashboard = async (req, res) => {
    const { playlistUrl } = req.body.courseDashboard;
    const queryString = playlistUrl.substring(playlistUrl.indexOf('?'));
    const urlParams = new URLSearchParams(queryString);
    const playlistId = urlParams.getAll('list')[0];
    const videosData = await axios.get(
        `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${youtubeApiKey}&maxResults=99`,
        { headers: { 'Accept': 'application/json' } }
    );
    const playlistData = await axios.get(
        `https://youtube.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${youtubeApiKey}`,
        { headers: { 'Accept': 'application/json' } }
    );
    const title = playlistData.data.items[0].snippet.title;
    const videos = [];
    for (let i = 0; i < videosData.data.pageInfo.totalResults; i++) {
        videos[i] = new Video({
            title: videosData.data.items[i].snippet.title,
            videoId: videosData.data.items[i].snippet.resourceId.videoId
        });
        await videos[i].save();
    }
    const numberOfClasses = 0;
    const dashboard = new CourseDashboard({
        title,
        playlistId,
        numberOfClasses,
        videos,
        author: req.user._id
    });
    await dashboard.save();
    req.flash('success', 'Dashboard criado com sucesso!');
    res.redirect(`/coursedashboards/${dashboard._id}`);
}

module.exports.showCourseDashboard = async (req, res) => {
    const { id } = req.params;
    const dashboard = await CourseDashboard.findById(id)
        .populate('videos')
        .populate('author');
    const videosData = await axios.get(
        `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${dashboard.playlistId}&key=${youtubeApiKey}&maxResults=99`,
        { headers: { 'Accept': 'application/json' } }
    );
    if (videosData.data.pageInfo.totalResults > dashboard.videos.length - 1) {
        let newVideos = [];
        for (let i = 0; i < videosData.data.pageInfo.totalResults - dashboard.videos.length; i++) {
            newVideos[i] = new Video({
                title: videosData.data.items[i + dashboard.videos.length].snippet.title,
                videoId: videosData.data.items[i + dashboard.videos.length].snippet.resourceId.videoId
            });
            await newVideos[i].save();
        }
        await CourseDashboard.updateOne(
            { _id: dashboard._id },
            { $push: { videos: newVideos } }
        );
    }
    let nonMoodleMaterial = 0;
    if (!checkUrl.isMoodle(dashboard.classes)) {
        console.log("material n est?? todo no moodle");
        nonMoodleMaterial = 1;
    }
    res.render('courseDashboards/show', { dashboard, nonMoodleMaterial });
}

module.exports.updateCourseDashboard = async (req, res) => {
    const { id } = req.params;
    // await CourseDashboard.findByIdAndUpdate(id, { ...req.body.dashboard });
    const dashboard = await CourseDashboard.findById(id);
    dashboard.title = req.body.dashboard.title;
    dashboard.environmentUrl = req.body.dashboard.environmentUrl;
    dashboard.forumUrl = req.body.dashboard.forumUrl;
    await dashboard.save();
    req.flash('success', 'Dashboard salvo com sucesso!');
    res.redirect(`/courseDashboards/${id}`);
}

module.exports.showMaterial = async (req, res) => {
    const { id } = req.params;
    const dashboard = await CourseDashboard.findById(id);
}

module.exports.deleteCourseDashboard = async (req, res) => {
    const { id } = req.params;
    await CourseDashboard.deleteOne({ _id: id });
    req.flash('success', 'Dashboard deletado com sucesso!');
    res.redirect('/courseDashboards');
}

module.exports.renderEditClassForm = async (req, res) => {
    const { id, classNum } = req.params;
    const dashboard = await CourseDashboard.findById(id);
    // const numClasses = dashboard.classes.length;
    // dashboard.classes.push({ classNumber: numClasses });
    // await dashboard.save();
    const playlistId = dashboard.playlistId;
    const videosData = await axios.get(
        `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&key=${youtubeApiKey}&maxResults=99`,
        { headers: { 'Accept': 'application/json' } }
    );
    let videos = [];
    for (let video of videosData.data.items) {
        let title = video.snippet.title;
        let videoId = video.snippet.resourceId.videoId;
        videos.push({ title, videoId });
    }
    res.render('courseDashboards/editClass', { dashboard, videos, classNum });
}

module.exports.renderEditVideoInformationForm = async (req, res) => {
    const { id, videoId } = req.params;
    const dashboard = await CourseDashboard.findById(id);
    const video = await Video.findById(videoId);
    res.render('courseDashboards/editVideoInformation', { dashboard, video });
}

module.exports.updateVideoInformation = async (req, res) => {
    const { id, videoId } = req.params;
    await Video.findByIdAndUpdate(videoId, {
        supportMaterial: req.body.video.supportMaterial,
        inClassExercises: req.body.video.inClassExercises,
        outOfClassExercises: req.body.video.outOfClassExercises
    });
    req.flash('success', 'Dashboard salvo com sucesso!');
    res.redirect(`/courseDashboards/${id}`);
}

module.exports.updateClassInformation = async (req, res) => {
    const { id, classNum } = req.params;
    const dashboard = await CourseDashboard.findById(id);
    console.log(req.body.thisClass.preClassMaterial.essential);
    dashboard.classes[classNum] = { ...req.body.thisClass };
    await dashboard.save();
    req.flash('success', 'Aula salva com sucesso!');
    res.redirect(`/courseDashboards/${id}/classes/${classNum}`);
}

module.exports.deleteClass = async (req, res) => {
    const { id, classNum } = req.params;
    const dashboard = await CourseDashboard.findById(id);
    dashboard.classes.splice(classNum, 1);
    console.log(dashboard.classes);
    for (let i = classNum; i < dashboard.classes.length; i++) {
        dashboard.classes[i].classNumber--;
    }
    await dashboard.save();
    req.flash('success', 'Aula deletada com sucesso!');
    res.redirect(`/courseDashboards/${id}`);
}

module.exports.renderCourseDashboard = async (req, res) => {
    const { id, videoIndex } = req.params;
    const dashboard = await CourseDashboard.findById(id)
        .populate('videos');
    const { videoId } = dashboard.videos[videoIndex];
    const chaptersData = await chapters.getChaptersData(videoId);
    res.render('dashboards/courseDashboard', { dashboard, videoIndex, chaptersData });
}