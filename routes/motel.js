const express = require("express");
const router = express.Router();
const school = require("../models/school");
const motel = require("../models/motel");
const user = require("../models/user");
const removeVietNameseTones = require("../utils/removeVietnameseTones");
const verifyToken = require("../middleware/verifyToken");
const unapprovedMotel = require("../models/unapproved-motel");
const upload = require("../middleware/upload");
const shuffle = require("../utils/shuffle");
const userUpdateMotel = require("../models/user-update-motel");
const JWT = require("jsonwebtoken");
const add = require("../utils/done");
const { change } = require("../utils/creditFunction");
const plus = async (idUser) => {
  const a = await user.findByIdAndUpdate(idUser, { $inc: { motels: 1 } });
  if (!a) return false;
  return true;
};

const motelRouter = (io) => {
  router.get("/randoms", async (req, res) => {
    let listMotel = await motel
      .find({})
      .populate("school", "-nameDistricts")
      .populate(
        "rate.user",
        "-notify -refreshToken  -unsignedName -password -favorite -deleted -province -district"
      )
      .populate(
        "owner",
        "-notify -refreshToken  -unsignedName -password -favorite -deleted -province -district"
      )
      .populate("editor.user", "name avatarUrl _id isAdmin");
    listMotel = shuffle(listMotel);

    let newData = [];

    for (let i = 0; i < listMotel.length; i++) {
      let rateData = [];
      let ownerData;
      let editorData = [];
      let imagesUrl = [];
      let optional = {
        wifi: false,
        ml: false,
        gac: false,
        nx: false,
        camera: false,
        quat: false,
        tl: false,
        giuong: false,
        gt: false,
        cc: false,
        dcvs: false,
      };
      for (let j = 0; j < listMotel[i].room.length; j++)
        for (const property in listMotel[i].room[j].optional) {
          if (listMotel[i].room[j].optional[property] == true)
            optional[property] = true;
        }

      for (let j = 0; j < listMotel[i].rate.length; j++) {
        const userNewData = {
          _id: listMotel[i].rate[j].user._id,
          name: listMotel[i].rate[j].user.name,
          avatarUrl: listMotel[i].rate[j].user.avatarUrl.url,
          credit: listMotel[i].rate[j].user.credit,
          email: listMotel[i].rate[j].user.email,
          isAdmin: listMotel[i].rate[j].user.isAdmin,
          posts: listMotel[i].rate[j].user.posts,
          motels: listMotel[i].rate[j].user.motels,
          totalLikes: listMotel[i].rate[j].user.likes.length,
          school: listMotel[i].rate[j].user.school,
        };
        if (listMotel[i].rate[j].valid)
          rateData.push({ ...listMotel[i].rate[j]._doc, user: userNewData });
      }
      if (listMotel[i].owner) {
        const avatarUrl = listMotel[i].owner.avatarUrl.url;
        ownerData = {
          avatarUrl,
          name: listMotel[i].owner.name,
          _id: listMotel[i].owner._id,
          email: listMotel[i].owner.email,
          isAdmin: listMotel[i].owner.isAdmin,
          credit: listMotel[i].owner.credit,
          posts: listMotel[i].owner.posts,
          motels: listMotel[i].owner.motels,
          totalLikes: listMotel[i].owner.likes.length,
          school: listMotel[i].owner.school,
        };
      } else ownerData = null;
      if (Array.isArray(listMotel[i].editor)) {
        for (let j = 0; j < listMotel[i].editor.length; j++) {
          let editorDataUser;
          const avatarUrl = listMotel[i].editor[j].user.avatarUrl.url;
          editorDataUser = {
            avatarUrl,
            name: listMotel[i].editor[j].user.name,
            _id: listMotel[i].editor[j].user._id,
            isAdmin: listMotel[i].editor[j].user.isAdmin,
          };
          editorData.push({
            user: editorDataUser,
            edited: listMotel[i].editor[j].edited,
            createdAt: listMotel[i].editor[j].createdAt,
          });
        }
      }
      let thumbnailUrl = listMotel[i].thumbnail.url;
      listMotel[i].images.forEach((image) => {
        imagesUrl.push(image.url);
      });
      newData.push({
        ...listMotel[i]._doc,
        owner: ownerData,
        editor: editorData,
        thumbnail: thumbnailUrl,
        images: imagesUrl,
        rate: rateData,
        optional,
      });
    }
    let limit = listMotel.length;
    let page = 1;
    let totalRows = listMotel.length;
    if (req.query._limit && req.query._page) {
      if (
        !isNaN(parseInt(req.query._limit)) &&
        !isNaN(parseInt(req.query._page))
      ) {
        limit = parseInt(req.query._limit);
        page = parseInt(req.query._page);
        newData = newData.slice((page - 1) * limit, limit * page);
      }
    }
    res.status(200).json({
      success: true,
      message: "Thành Công",
      data: newData,
      pagination: { _totalRows: totalRows, _page: page, _limit: limit },
    });
  });

  router.patch("/:id", verifyToken, async (req, res) => {
    try {
      const motelUpdate = await motel
        .findById(req.params.id)
        .select("-room -rate");
      if (!motelUpdate)
        return res
          .status(404)
          .json({ success: true, message: "Không tìm thấy nhà trọ" });

      let {
        id,
        name,
        thumbnail,
        images,
        address,
        desc,
        contact,
        status,
        school,
        available,
      } = req.body;
      if (
        !name &&
        !thumbnail &&
        !images &&
        !address &&
        !desc &&
        !contact &&
        typeof status === "undefined" &&
        !school &&
        !available
      )
        return res.status(400).json({
          success: false,
          message: "Không tìm thấy dữ liệu cần cập nhật",
        });
      if (Array.isArray(images) == false)
        if (typeof images !== "undefined") images = images.old;

      let userAtr = req.user.id;

      let edited = "Chỉnh sửa nhà trọ: ";
      if (typeof name === "string")
        if (motelUpdate.name != name) edited += "tên nhà trọ";

      if (thumbnail)
        if (thumbnail.public_id)
          if (thumbnail.url != motelUpdate.thumbnail.url)
            if (edited === "Chỉnh sửa nhà trọ: ") edited += "ảnh bìa";
            else edited += ", ảnh bìa";
      if (typeof address === "string")
        if (address != motelUpdate.address)
          if (edited === "Chỉnh sửa nhà trọ: ") edited += "địa chỉ";
          else edited += ", địa chỉ";
      if (typeof desc === "string")
        if (desc != motelUpdate.desc)
          if (edited === "Chỉnh sửa nhà trọ: ") edited += "giới thiệu";
          else edited += ", giới thiệu";
      if (contact)
        if (
          typeof contact.phone === "string" ||
          typeof contact.zalo === "string" ||
          typeof contact.email === "string" ||
          typeof contact.facebook === "string"
        )
          if (
            motelUpdate.contact.zalo != contact.zalo ||
            motelUpdate.contact.phone != contact.phone ||
            motelUpdate.contact.facebook != contact.facebook ||
            motelUpdate.contact.email != contact.email
          )
            if (edited === "Chỉnh sửa nhà trọ: ") edited += "thông tin liên hệ";
            else edited += ", thông tin liên hệ";
      if (typeof status === "boolean")
        if (motelUpdate.status != status)
          if (edited === "Chỉnh sửa nhà trọ: ") edited += "trang thái";
          else edited += ", trạng thái";
      if (typeof available === "number")
        if (available != motelUpdate.available)
          if (edited === "Chỉnh sửa nhà trọ: ") edited += "phòng trống";
          else edited += ", phòng trống";

      if (Array.isArray(school))
        for (let i = 0; i < school.length; i++) {
          if (
            !motelUpdate.school.some((item) => {
              JSON.stringify(item) === JSON.stringify(school[i]._id);
            })
          ) {
            if (edited === "Chỉnh sửa nhà trọ: ") edited += "lân cận";
            else edited += ", lân cận";
            break;
          }
        }

      if (name) {
        if (typeof name === "string") {
          motelUpdate.name = name;
          motelUpdate.unsignedName = removeVietNameseTones(name);
        }
      }

      const oldThumbnail = motelUpdate.thumbnail.public_id;

      if (thumbnail)
        if (typeof thumbnail === "object")
          if (thumbnail.public_id !== oldThumbnail) {
            motelUpdate.thumbnail = thumbnail;
          }
      if (address)
        if (typeof address === "string") {
          motelUpdate.address = address;
        }
      if (desc) if (typeof desc === "string") motelUpdate.desc = desc;
      if (contact)
        if (
          typeof contact.phone === "string" ||
          typeof contact.zalo === "string" ||
          typeof contact.email === "string" ||
          typeof contact.facebook === "string"
        ) {
          motelUpdate.contact = contact;
        }
      if (typeof status === "boolean") {
        motelUpdate.status = status;
      }
      if (Array.isArray(school) == true) {
        motelUpdate.school = school;
      }
      if (typeof available === "number") {
        motelUpdate.available = available;
      }
      let oldImages = motelUpdate.images;
      let newImage = [];
      let oldImage = [];

      if (Array.isArray(images) == true) {
        for (let i = 0; i < images.length; i++) {
          typeof images[i] === "string"
            ? oldImage.push(images[i])
            : newImage.push(images[i]);
        }
      }
      if (newImage.length > 0)
        if (edited === "Chỉnh sửa nhà trọ: ") edited += "hình ảnh";
        else edited += ", hình ảnh";
      if (req.user.isAdmin == true || req.user.credit > 150) {
        if (motelUpdate.editor.length >= 3) motelUpdate.editor.shift();
        motelUpdate.editor.push({
          user: userAtr,
          edited: edited,
          createdAt: Date.now(),
        });
        if (thumbnail)
          if (typeof thumbnail === "object")
            if (thumbnail.public_id !== oldThumbnail)
              await upload.unlink(oldThumbnail);
        if (Array.isArray(images)) {
          var removeImages = oldImages.reduce((arr, image) => {
            if (!oldImage.includes(image.url)) arr.push(image);
            return arr;
          }, []);

          for (let i = 0; i < removeImages.length; i++) {
            await upload.unlink(removeImages[i].public_id);
          }

          oldImages = oldImages.filter((image) => {
            let result = true;
            removeImages.forEach((remove) => {
              if (remove.url === image.url) {
                result = false;
                return;
              }
            });
            return result;
          });
          oldImages = [...oldImages, ...newImage];
          motelUpdate.images = oldImages;
        }
        await motelUpdate.save();
        res
          .status(200)
          .json({ success: true, message: "Đã cập nhật thành công" });
        add(
          userAtr,
          "Chỉnh sửa nhà trọ",
          {
            type: "updatedMotel",
            motelId: motelUpdate._id,
            edited: edited,
            name: motelUpdate.name,
          },
          io
        );
      } else {
        if (Array.isArray(images)) {
          var removeImages = oldImages.reduce((arr, image) => {
            if (!oldImage.includes(image.url)) arr.push(image);
            return arr;
          }, []);

          oldImages = oldImages.filter((image) => {
            let result = true;
            removeImages.forEach((remove) => {
              if (remove.url === image.url) {
                result = false;
                return;
              }
            });
            return result;
          });
          oldImages = [...oldImages, ...newImage];
          motelUpdate.images = oldImages;
        }
        let newUserUpdateMotel = new userUpdateMotel({
          name: motelUpdate.name,
          unsignedName: motelUpdate.unsignedName,
          thumbnail: motelUpdate.thumbnail,
          images: motelUpdate.images,
          address: motelUpdate.address,
          desc: motelUpdate.desc,
          contact: motelUpdate.contact,
          status: motelUpdate.status,
          available: motelUpdate.available,
          school: motelUpdate.school,
          user: req.user.id,
          motel: motelUpdate.id,
        });

        await newUserUpdateMotel.save();

        io.sendDashboardStatisticals("approvals");
        res
          .status(200)
          .json({ success: true, message: "Thành công, vui lòng chờ duyệt" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ success: false, message: "Lỗi không xác định" });
    }
  });

  router.get("/schools", async (req, res) => {
    const { _namelike } = req.query;
    if (_namelike)
      var keySearchs = [
        { codeName: new RegExp(_namelike.replace(/ /g, "_"), "i") },
        {
          codeName: new RegExp("^" + _namelike.replace(/ /g, "_"), "i"),
        },
        {
          codeName: new RegExp(_namelike.replace(/ /g, "_") + "$", "i"),
        },
      ];
    if (_namelike) var schools = await school.find({ $or: keySearchs });
    else var schools = await school.find({});
    const motels = await motel.find({}).select("_id thumbnail school");
    let data = [];
    for (let i = 0; i < schools.length; i++) {
      const getMotelOfSchool = motels.filter((item) => {
        const condition = (motel) => {
          let bool = false;

          motel.school.forEach((s) => {
            if (JSON.stringify(s) === JSON.stringify(schools[i]._id)) {
              bool = true;
              return;
            }
          });
          return bool;
        };
        return condition(item);
      });

      let motelsData = [];
      for (let j = 0; j < getMotelOfSchool.length; j++) {
        const thumbnail = getMotelOfSchool[j].thumbnail.url;
        motelsData.push({ thumbnail: thumbnail, _id: motels[j]._id });
      }
      data.push({
        motels: motelsData,
        _id: schools[i]._id,
        logo: schools[i].logo,
        name: schools[i].name,
        codeName: schools[i].codeName,
      });
    }
    res.status(200).json({ success: true, message: "Thành công", data: data });
  });

  router.delete("/:id", verifyToken, async (req, res) => {
    if (!req.params.id)
      return res
        .status(400)
        .json({ success: false, message: "Không có thông tin" });
    const id = req.params.id;
    if (req.user.isAdmin != true && req.user.credit < 1001)
      return res
        .status(400)
        .json({ success: false, message: "Không đủ quyền hạn truy cập" });
    const checkMotel = await motel.findByIdAndDelete(id);
    if (!checkMotel)
      return res
        .status(400)
        .json({ success: false, message: "Không có nhà trọ" });
    const deleteMotelImage = await unlinkImageMotel(
      checkMotel.thumbnail,
      checkMotel.images
    );
    io.sendDashboardStatisticals("motels");
    io.sendDashboardRecent("motels");
    return res.status(200).json({ success: true, message: "Đã xóa nhà trọ" });
  });

  router.get("/", async (req, res) => {
    let {
      _order,
      _sort,
      _keysearch,
      _limit,
      _page,
      _owner,
      _optional,
      _school,
      _status,
      _price,
      _rate,
    } = req.query;

    const keySearchs = [
      { unsignedName: new RegExp(_keysearch, "i") },
      {
        unsignedName: new RegExp("^" + _keysearch, "i"),
      },
      {
        unsignedName: new RegExp(_keysearch + "$", "i"),
      },

      { address: new RegExp(_keysearch, "i") },
      {
        address: new RegExp("^" + _keysearch, "i"),
      },
      {
        address: new RegExp(_keysearch + "$", "i"),
      },
    ];
    // if (_school) var _schools = _school.split(" ");
    if (_keysearch)
      var listMotel = await motel
        .find({ $or: keySearchs })
        .populate("school", "-nameDistricts")
        .populate("rate.user", "-refreshToken")
        .populate("owner")
        .populate("editor.user");
    else {
      var listMotel = await motel
        .find({})
        .populate("school", "-nameDistricts")
        .populate("rate.user", "-refreshToken")
        .populate("owner")
        .populate("editor.user");
    }

    if (_keysearch) {
      const addMotelUser = await user
        .find({
          $or: [
            { unsignedName: new RegExp(_keysearch, "i") },
            {
              unsignedName: new RegExp("^" + _keysearch, "i"),
            },
            {
              unsignedName: new RegExp(_keysearch + "$", "i"),
            },
          ],
        })
        .select("_id");
      let addMotelUser2 = await motel
        .find({})
        .populate("school", "-nameDistricts")
        .populate("rate.user", "-refreshToken")
        .populate("owner")
        .populate("editor.user");
      addMotelUser.forEach((item) => {
        addMotelUser2.forEach((item2) => {
          if (JSON.stringify(item._id) === JSON.stringify(item2.owner._id)) {
            if (
              listMotel.some((motel) => {
                JSON.stringify(motel.owner._id) === JSON.stringify(item._id);
              })
            ) {
            } else {
              listMotel.push(item2);
            }
          }
        });
      });
    }
    if (Array.isArray(_school))
      listMotel = listMotel.filter((item) => {
        for (let i = 0; i < item.school.length; i++) {
          for (let j = 0; j < _school.length; j++) {
            if (item.school[i].codeName === _school[j]) return true;
          }
        }
        return false;
      });
    if (typeof _status === "string") {
      if (_status.toLowerCase() === "true" || _status.toLowerCase() === "false")
        listMotel = listMotel.filter((item) => {
          return String(item.status) == _status.toLowerCase();
        });
    } else if (Array.isArray(_status)) {
      if (
        typeof _status[0] !== "undefined" &&
        typeof _status[1] !== "undefined"
      ) {
        if (_status[0].toLowerCase() === "false")
          listMotel = listMotel.filter((item) => {
            return item.status == false;
          });
        if (_status[1].toLowerCase() === "false")
          listMotel = listMotel.filter((item) => {
            return item.status == true;
          });
      }
    }
    if (_owner)
      listMotel = listMotel.filter((item) => {
        item.owner._id === _owner;
      });
    if (_order && _sort)
      switch (_sort) {
        case "createdat":
          if (_order === "asc")
            listMotel = listMotel.sort(
              (motel1, motel2) =>
                new Date(motel1.createdAt) - new Date(motel2.createdAt)
            );
          else if (_order === "desc")
            listMotel = listMotel.sort(
              (motel1, motel2) =>
                new Date(motel2.createdAt) - new Date(motel1.createdAt)
            );

          break;
        case "room":
          if (_order === "asc")
            listMotel = listMotel.sort(
              (motel1, motel2) => motel1.room.length - motel2.room.length
            );
          else if (_order == "desc") {
            listMotel = listMotel.sort(
              (motel1, motel2) => motel2.room.length - motel1.room.length
            );
          }
          break;
        case "mark":
          if (_order === "asc")
            listMotel = listMotel.sort(
              (motel1, motel2) => motel1.mark - motel2.mark
            );
          else if (_order == "desc") {
            listMotel = listMotel.sort(
              (motel1, motel2) => motel2.mark - motel1.mark
            );
          }

          break;
        case "vote":
          if (_order === "asc")
            listMotel = listMotel.sort(
              (motel1, motel2) => motel1.vote - motel2.vote
            );
          else if (_order == "desc") {
            listMotel = listMotel.sort(
              (motel1, motel2) => motel2.vote - motel1.vote
            );
          }

          break;
        case "rate":
          if (_order === "asc")
            listMotel = listMotel.sort(
              (motel1, motel2) => motel1.rate.length - motel2.rate.length
            );
          else if (_order == "desc") {
            listMotel = listMotel.sort(
              (motel1, motel2) => motel2.rate.length - motel1.rate.length
            );
          }

          break;
        default:
          break;
      }

    if (Array.isArray(_price))
      listMotel = listMotel.filter((item) => {
        return (
          item.room.some((room) => {
            return room.price >= parseInt(_price[0]);
          }) &&
          item.room.some((room) => {
            return room.price <= parseInt(_price[1]);
          })
        );
      });

    if (typeof _rate === "string")
      if (typeof parseInt(_rate) === "number")
        listMotel = listMotel.filter((item) => {
          return item.mark >= parseInt(_rate);
        });

    if (_optional) {
      listMotel = listMotel.filter((item) => {
        function filterRoomType(motel) {
          let bool = false;
          for (let j = 0; j < motel.room.length; j++) {
            let count = 0;
            for (let i = 0; i < _optional.length; i++) {
              if (motel.room[j].optional[_optional[i]] == true) count++;
            }
            if (count == _optional.length) {
              bool = true;
              break;
            }
          }

          return bool;
        }

        return filterRoomType(item);
      });
    }
    const totalRows = listMotel.length;
    _page = parseInt(_page);
    _limit = parseInt(_limit);
    if (_page && _limit)
      listMotel = listMotel.slice(
        _limit * (_page - 1),
        _limit + _limit * (_page - 1)
      );
    let newData = [];
    for (let i = 0; i < listMotel.length; i++) {
      let rateData = [];
      let ownerData;
      let editorData = [];
      let imagesUrl = [];
      let optional = {
        wifi: false,
        ml: false,
        gac: false,
        nx: false,
        camera: false,
        quat: false,
        tl: false,
        giuong: false,
        gt: false,
        cc: false,
        dcvs: false,
      };
      for (let j = 0; j < listMotel[i].room.length; j++)
        for (const property in listMotel[i].room[j].optional) {
          if (listMotel[i].room[j].optional[property] == true)
            optional[property] = true;
        }
      for (let j = 0; j < listMotel[i].rate.length; j++) {
        const userNewData = {
          _id: listMotel[i].rate[j].user._id,
          name: listMotel[i].rate[j].user.name,
          avatarUrl: listMotel[i].rate[j].user.avatarUrl.url,
          credit: listMotel[i].rate[j].user.credit,
          isAdmin: listMotel[i].rate[j].user.isAdmin,
          rank: listMotel[i].rate[j].user.rank,
          posts: listMotel[i].rate[j].user.posts,
          school: listMotel[i].rate[j].user.school,
          motels: listMotel[i].rate[j].user.motels,
          email: listMotel[i].rate[j].user.email,
          totalLikes: listMotel[i].rate[j].user.likes.length,
        };
        if (listMotel[i].rate[j].valid)
          rateData.push({ ...listMotel[i].rate[j]._doc, user: userNewData });
      }
      if (listMotel[i].owner) {
        const avatarUrl = listMotel[i].owner.avatarUrl.url;
        ownerData = {
          avatarUrl,
          name: listMotel[i].owner.name,
          _id: listMotel[i].owner._id,
          isAdmin: listMotel[i].owner.isAdmin,
          credit: listMotel[i].owner.credit,
          rank: listMotel[i].owner.rank,
          school: listMotel[i].owner.school,
          posts: listMotel[i].owner.posts,
          motels: listMotel[i].owner.motels,
          totalLikes: listMotel[i].owner.likes.length,
          email: listMotel[i].owner.email,
        };
      } else ownerData = null;
      if (Array.isArray(listMotel[i].editor)) {
        for (let j = 0; j < listMotel[i].editor.length; j++) {
          let editorDataUser;
          const avatarUrl = listMotel[i].editor[j].user.avatarUrl.url;
          editorDataUser = {
            avatarUrl,
            name: listMotel[i].editor[j].user.name,
            _id: listMotel[i].editor[j].user._id,
            isAdmin: listMotel[i].editor[j].user.isAdmin,
          };
          editorData.push({
            user: editorDataUser,
            edited: listMotel[i].editor[j].edited,
            createdAt: listMotel[i].editor[j].createdAt,
          });
        }
      }
      let thumbnailUrl = listMotel[i].thumbnail.url;
      listMotel[i].images.forEach((image) => {
        imagesUrl.push(image.url);
      });
      newData.push({
        ...listMotel[i]._doc,
        owner: ownerData,
        editor: editorData,
        thumbnail: thumbnailUrl,
        images: imagesUrl,
        rate: rateData,
        optional,
      });
    }

    let page = 1,
      limit = totalRows;
    if (_page && _limit) {
      page = _page;
      limit = _limit;
    }

    return res.status(200).json({
      success: true,
      message: "Thành công",
      data: newData,
      pagination: { _page: page, _limit: limit, _totalRows: totalRows },
    });
  });
  const unlinkImageMotel = async (thumbnail, images) => {
    if (thumbnail != undefined) await upload.unlink(thumbnail.public_id);
    if (images != undefined)
      for (let i = 0; i < images.length; i++) {
        await upload.unlink(images[i].public_id);
      }
  };

  router.post("/", verifyToken, async (req, res) => {
    if (req.user.credit < 21)
      return res.status(400).json({
        message:
          "Bạn chưa đủ quyền hạn để gửi nhà trọ, yêu cầu điểm tín dụng tối thiểu là 21",
        success: false,
      });
    let {
      name,
      thumbnail,
      images,
      address,
      desc,
      room,
      contact,
      status,
      school,
      available,
    } = req.body;

    if (typeof thumbnail === "undefined") {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp ảnh tiêu đề" });
    }
    if (thumbnail)
      if (
        typeof thumbnail.url !== "string" ||
        typeof thumbnail.public_id !== "string"
      )
        return res
          .status(400)
          .json({ success: false, message: "Vui lòng cung cấp ảnh tiêu đề" });
    if (typeof name !== "string") {
      await unlinkImageMotel(thumbnail, images);
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp tên nhà trọ" });
    }
    if (name === "") {
      await unlinkImageMotel(thumbnail, images);
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp tên nhà trọ" });
    }
    if (name === "post") {
      await unlinkImageMotel(thumbnail, images);
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp tên nhà trọ hợp lệ",
      });
    }
    if (!address) {
      await unlinkImageMotel(thumbnail, images);
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp địa chỉ nhà trọ" });
    }
    if (address === "") {
      await unlinkImageMotel(thumbnail, images);
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp địa chỉ nhà trọ" });
    }
    if (!desc) {
      await unlinkImageMotel(thumbnail, images);
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp một vài mô tả" });
    }
    if (desc === "") {
      await unlinkImageMotel(thumbnail, images);
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp một vài mô tả" });
    }
    if (
      !contact ||
      (!contact.phone && !contact.email && !contact.facebook && !contact.zalo)
    ) {
      await unlinkImageMotel(thumbnail, images);
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp ít nhất một cách liên lạc nhà trọ",
      });
    }
    if (typeof status !== "boolean") {
      await unlinkImageMotel(thumbnail, images);
      return res.status(400).json({
        success: false,
        message: "Vui lòng cho biết còn phòng trống hay không",
      });
    }
    if (!images) images = [];
    if (images) if (!Array.isArray(images)) images = [images];
    if (!room) {
      await unlinkImageMotel(thumbnail, images);
      return res.status(400).json({
        success: false,
        message: "Vui lòng cho biết ít nhất một loại phòng ở nhà trọ",
      });
    }
    if (room) {
      if (room.optional) {
        if (
          typeof room.amount !== "number" ||
          typeof room.price !== "number" ||
          typeof room.area.width !== "number" ||
          typeof room.area.length !== "number" ||
          typeof room.total !== "number" ||
          typeof room.remain !== "number" ||
          typeof room.status !== "boolean"
        ) {
          await unlinkImageMotel(thumbnail, images);
          return res.status(400).json({
            success: false,
            message: "Thuộc tính phòng trọ bị sai",
          });
        }
      }
      for (let j = 0; j < room.length; j++) {
        let optional = {
          wifi: false,
          ml: false,
          gac: false,
          nx: false,
          camera: false,
          quat: false,
          tl: false,
          giuong: false,
          gt: false,
          cc: false,
          dcvs: false,
        };

        for (let i = 0; i < room[j].optional.length; i++) {
          optional[room[j].optional[i]] = true;
        }
        room[j].optional = optional;
      }
    }

    if (req.user.isAdmin == true || req.user.credit > 300) {
      const newMotel = new motel({
        name,
        unsignedName: removeVietNameseTones(name),
        thumbnail,
        images: [],
        address,
        desc,
        room,
        contact,
        status,
        vote: undefined,
        rate: [],
        mark: undefined,
        school,
        owner: req.user.id,
        editor: [],
        available,
      });
      for (let i = 0; i < images.length; i++) {
        const renameImage = await upload.rename(
          images[i].public_id,
          newMotel._id +
            "/" +
            images[i].public_id.substr(images[i].public_id.indexOf("/") + 1)
        );
        if (renameImage.success == true)
          newMotel.images.push({
            public_id: renameImage.data.public_id,
            url: renameImage.data.url,
          });
        else {
          for (let j = 0; j < newMotel.images.length; j++)
            await upload.unlink(newMotel.images[j].public_id);

          for (let j = i; j < images.length; j++)
            await upload.unlink(images[j].public_id);

          await upload.unlink(thumbnail.public_id);
          return res
            .status(400)
            .json({ success: false, message: "Lỗi hình ảnh nhà trọ" });
        }
      }
      const renameThumbnail = await upload.rename(
        thumbnail.public_id,
        newMotel._id +
          "/" +
          thumbnail.public_id.substr(thumbnail.public_id.indexOf("/") + 1)
      );
      if (renameThumbnail.success)
        newMotel.thumbnail = {
          public_id: renameThumbnail.data.public_id,
          url: renameThumbnail.data.url,
        };
      else {
        unlinkImageMotel(thumbnail, newMotel.images);
        return res
          .status(400)
          .json({ success: false, message: "Lỗi hình ảnh" });
      }

      try {
        const duplicateCheck = await check(newMotel.name, newMotel.school);
        const duplicateUnapprovedCheck = await checkUnapproved(
          newMotel.name,
          newMotel.school
        );
        if (duplicateCheck.dup == true) {
          if (req.user.isAdmin == true) {
            await unlinkImageMotel(newMotel.thumbnail, newMotel.images);
            return res.status(400).json({
              success: false,
              message: "Vui lòng xem xét lại, có vẻ đã tồn tại nhà trọ này rồi",
              data: duplicateCheck.motel,
            });
          }
        }
        const newMotelUnapproved = new unapprovedMotel({
          name,
          unsignedName: removeVietNameseTones(name),
          thumbnail,
          images,
          address,
          desc,
          room,
          contact,
          status,
          vote: undefined,
          rate: [],
          mark: undefined,
          school,
          owner: req.user.id,
          editor: [],
          available,
        });
        if (duplicateCheck.dup == true)
          newMotelUnapproved.duplicate = duplicateCheck.motel;
        if (duplicateUnapprovedCheck.dup == true)
          newMotelUnapproved.duplicateUnapproved =
            duplicateUnapprovedCheck.motel;
        if (duplicateCheck.dup == true || duplicateUnapprovedCheck == true) {
          await newMotelUnapproved.save();
          io.sendDashboardRecent("motels");
          io.sendDashboardStatisticals("approvals");
          change(req.user.id, 2, io);
          return res.status(200).json({
            success: true,
            message:
              "Thêm thành công, nhưng nhà trọ này dường như đã có từ trước, vui lòng chờ chúng tôi xem xét",
          });
        }

        await newMotel.save();
        await plus(newMotel.owner);
        add(
          req.user.id,
          "Đăng nhà trọ mới",
          {
            type: "createdMotel",
            motelId: newMotel._id,
            desc: desc,
            name: name,
          },
          io
        );

        const getNameUser = await user.findById(req.user.id).select("name");
        io.notifyToAllUser({
          message: `${getNameUser.name} vừa đăng nhà trọ mới, hãy tham khảo ngay`,
          url: `/motels/${newMotel._id}`,
          imageUrl:
            "https://res.cloudinary.com/dpregsdt9/image/upload/v1638661792/notify/motel_opx8rh.png",
        });
        change(req.user.id, 5, io);
        io.sendDashboardRecent("motels");
        io.sendDashboardStatisticals("motels");
        return res.status(200).json({
          success: true,
          message: "Thêm thành công",
        });
      } catch (err) {
        await motel.findByIdAndDelete(newMotel._id);
        console.log(err);
        await unlinkImageMotel(newMotel.thumbnail, newMotel.images);
        return res.status(500).json({
          success: false,
          message: "Vui lòng thử lại",
        });
      }
    } else {
      const newMotel = new unapprovedMotel({
        name,
        unsignedName: removeVietNameseTones(name),
        thumbnail,
        images,
        address,
        desc,
        room,
        contact,
        status,
        vote: undefined,
        rate: [],
        mark: undefined,
        school,
        owner: req.user.id,
        editor: [],
        available,
      });
      try {
        const duplicateCheck = await check(newMotel.name, newMotel.school);
        const duplicateUnapprovedCheck = await checkUnapproved(
          newMotel.name,
          newMotel.school
        );
        if (duplicateCheck.dup == true)
          newMotel.duplicate = duplicateCheck.motel;
        if (duplicateUnapprovedCheck.dup == true)
          newMotel.duplicateUnapproved = duplicateUnapprovedCheck.motel;
        if (
          duplicateCheck.dup == true ||
          duplicateUnapprovedCheck.dup == true
        ) {
          await newMotel.save();
          change(req.user.id, 2, io);
          io.sendDashboardRecent("motels");
          io.sendDashboardStatisticals("approvals");
          return res.status(200).json({
            success: true,
            message:
              "Thêm thành công, nhưng nhà trọ này dường như đã có từ trước, vui lòng chờ chúng tôi xem xét",
          });
        }
        await newMotel.save();
        change(req.user.id, 2, io);
        io.sendDashboardStatisticals("approvals");
        io.sendDashboardRecent("motels");
        return res.status(200).json({
          success: true,
          message: "Thêm thành công, vui lòng chờ duyệt",
        });
      } catch (err) {
        console.log(err);
        await unlinkImageMotel(thumbnail, images);
        return res.status(500).json({
          success: false,
          message: "Vui lòng thử lại",
        });
      }
    }
  });

  router.get("/:id", async (req, res) => {
    const accessToken = req.headers.authorization;
    let userAuth = undefined;
    if (accessToken)
      JWT.verify(accessToken, process.env.accessToken, (err, data) => {
        if (err) {
        } else userAuth = data;
      });

    const id = req.params.id;
    const findMotel = await motel
      .findById(id)
      .populate(
        "rate.user",
        "name avatarUrl _id isAdmin credit email school motels rank posts likes"
      )
      .populate("school", "-nameDistricts")
      .populate(
        "owner",
        "name avatarUrl _id isAdmin credit email school motels rank posts likes"
      )
      .populate(
        "editor.user",
        "name avatarUrl _id isAdmin credit email school motels rank posts likes"
      );

    if (!findMotel)
      return res
        .status(400)
        .json({ success: false, message: "Không tìm thấy nhà trọ này" });
    let images = [];

    findMotel.images.forEach((image) => {
      images.push(image.url);
    });

    let newRate = [];
    for (let i = 0; i < findMotel.rate.length; i++) {
      const userRate = {
        name: findMotel.rate[i].user.name,
        isAdmin: findMotel.rate[i].user.isAdmin,
        _id: findMotel.rate[i].user._id,
        avatarUrl: findMotel.rate[i].user.avatarUrl.url,
        credit: findMotel.rate[i].user.credit,
        rank: findMotel.rate[i].user.rank,
        school: findMotel.rate[i].user.school,
        posts: findMotel.rate[i].user.posts,
        motels: findMotel.rate[i].user.motels,
        totalLikes: findMotel.rate[i].user.likes.length,
        email: findMotel.rate[i].user.email,
      };
      if (findMotel.rate[i].valid)
        newRate.push({ ...findMotel.rate[i]._doc, user: userRate });
    }
    let optional = {
      wifi: false,
      ml: false,
      gac: false,
      nx: false,
      camera: false,
      quat: false,
      tl: false,
      giuong: false,
      gt: false,
      cc: false,
      dcvs: false,
    };

    for (let i = 0; i < findMotel.room.length; i++)
      for (const property in findMotel.room[i].optional) {
        if (findMotel.room[i].optional[property] == true)
          optional[property] = true;
      }

    let owner = {
      avatarUrl: findMotel.owner.avatarUrl.url,
      name: findMotel.owner.name,
      isAdmin: findMotel.owner.isAdmin,
      _id: findMotel.owner.id,
      credit: findMotel.owner.credit,
      email: findMotel.owner.email,
      motels: findMotel.owner.motels,
      rank: findMotel.owner.rank,
      school: findMotel.owner.school,
      posts: findMotel.owner.posts,
      totalLikes: findMotel.owner.likes.length,
    };
    let editorData = [];
    for (let i = 0; i < findMotel.editor.length; i++) {
      let editorDataUser;
      const avatarUrl = findMotel.editor[i].user.avatarUrl.url;

      editorDataUser = {
        avatarUrl,
        name: findMotel.editor[i].user.name,
        _id: findMotel.editor[i].user._id,
        isAdmin: findMotel.editor[i].user.isAdmin,
        email: findMotel.editor[i].user.email,
        credit: findMotel.editor[i].user.credit,
        motels: findMotel.editor[i].user.motels,
        rank: findMotel.editor[i].user.rank,
        school: findMotel.editor[i].user.school,
        posts: findMotel.editor[i].user.posts,
        totalLikes: findMotel.editor[i].user.likes.length,
      };
      editorData.push({
        user: editorDataUser,
        edited: findMotel.editor[i].edited,
        createdAt: findMotel.editor[i].createdAt,
      });
    }
    const responseMotel = {
      ...findMotel._doc,
      rate: newRate,
      thumbnail: findMotel.thumbnail.url,
      images: images,
      optional,
      owner,
      editor: editorData,
    };
    responseMotel.rate = responseMotel.rate.sort((item1, item2) => {
      return new Date(item2.createdAt) - new Date(item1.createdAt);
    });
    if (userAuth != undefined) {
      console.log(userAuth);
      for (let i = 0; i < responseMotel.rate.length; i++) {
        let check = false;
        for (let j = i + 1; j < responseMotel.rate.length; j++)
          if (
            JSON.stringify(responseMotel.rate[j].user._id) ===
            JSON.stringify(userAuth.id)
          ) {
            const temp = responseMotel.rate[j];
            responseMotel.rate[j] = responseMotel.rate[i];
            responseMotel.rate[i] = temp;
            check = true;
            break;
          }
        if (check == false) {
          break;
        }
      }
    }
    res
      .status(200)
      .json({ success: true, message: "Thành công", data: responseMotel });
  });

  const checkUnapproved = async (name, schools) => {
    const findMotel = await unapprovedMotel
      .find({
        $and: [
          {
            $or: [
              {
                unsignedName: new RegExp(
                  removeVietNameseTones(name).replace(/nha tro /g, ""),
                  "i"
                ),
              },

              { unsignedName: new RegExp(removeVietNameseTones(name), "i") },
            ],
          },
          { $in: { school: schools } },
        ],
      })
      .select("_id");
    let d = [];
    findMotel.forEach((item) => {
      d.push(item._id);
    });
    if (findMotel.length > 0) return { dup: true, motel: d };
    else return { dup: false };
  };
  const check = async (name, schools) => {
    const findMotel = await motel
      .find({
        $and: [
          {
            $or: [
              {
                unsignedName: new RegExp(
                  removeVietNameseTones(name).replace(/nha tro /g, ""),
                  "i"
                ),
              },

              { unsignedName: new RegExp(removeVietNameseTones(name), "i") },
            ],
          },
          { $in: { school: schools } },
        ],
      })
      .select("_id");
    let d = [];
    findMotel.forEach((item) => {
      d.push(item._id);
    });
    if (findMotel.length > 0) return { dup: true, motel: d };
    else return { dup: false };
  };
  return router;
};
module.exports = motelRouter;
