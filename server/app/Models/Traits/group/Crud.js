'use strict'

const Group = use('App/Models/Group')
const User = use('App/Models/User')
const Event = use('Event')

const Authorization = use('App/Services/Authorization')

class Crud {

  register (Model) {

    Model.getUserGroups = async (request, auth) => {

      const user = await auth.getUser()

      const groups = await Group.query().where('user_id', user.id).paginate(request.input('page'), 5)

      return { groups }

    }

    Model.add = async (request, auth) => {

      const user = await auth.getUser()

      const { name, usersId } = request.all()

      let avatar = await User.Upload(request, 'avatarUploaded', user.id, 'avatars/groups')

      const group = await Group.create({ name, user_id: user.id, avatar })

      const friends = this.friendsId(usersId, user.id)

      group.users = await group.users().attach(friends)

      this.notifyUsers(friends)

      return { status: 'Group created successfully', group }

    }

    Model.edit = async (request, auth, group) => {

      let { usersId, avatarStatus } = request.all();

      const user = await auth.getUser()

      Authorization.check(group.user_id, user)

      let avatar = await User.Upload(request, 'avatarUploaded', user.id, 'avatars/groups')

      if (avatar) group.avatar = avatar

      if (avatarStatus === 'none') group.avatar = null
        
      group.merge(request.only('name'))

      await group.save()
      
      const friendsId = this.friendsId(usersId, user.id)
      
      const old = (await group.users().fetch()).toJSON().map(user => user.id)

      group.users = await group.users().sync(friendsId)

      this.notifyEditedUsers(old, friendsId)

      return { status: 'Group updated successfully', group }

    }

    Model.remove = async (auth, group) => {

      const user = await auth.getUser()

      Authorization.check(group.user_id, user)

      const usersId = (await group.users().fetch()).toJSON().map(user => user.id)

      await group.users().detach()
      
      await group.delete()

      this.notifyUsers(usersId)

      return { status: 'Group deleted successfully' }

    }

    Model.getGroup = async (auth, group) => {

      const user = await auth.getUser()

      Authorization.check(group.user_id, user)

      group.users = await group.users().fetch()

      const friends = await User.friends(user.id)

      return { group, friends }

    }

  }

  friendsId(usersId, userId) {

    if (typeof usersId === 'string') usersId = usersId.split(',').map(id => Number(id))

    if (!(usersId instanceof Array)) return [userId]

    usersId.push(userId)

    return [...new Set(usersId)]
  }

  async notifyEditedUsers(old, news) {

    const allUsers = old.filter(x => !news.includes(x)).concat(news)

    for (const userId of allUsers) await Event.fire('group', userId)

}

  async notifyUsers(usersId) {
    for (const userId of usersId) await Event.fire('group', userId)
  }

}

module.exports = Crud
